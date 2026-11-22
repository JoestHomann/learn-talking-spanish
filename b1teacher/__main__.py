import argparse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from threading import Lock, Timer
import webbrowser

from . import chatgpt, teacher
from .audio import AudioError, LocalAudio, MAX_AUDIO, models_ready
from .paths import PROJECT

ASSETS = {
    "/": ("index.html", "text/html; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
}
AUDIO_TYPES = {"audio/webm", "audio/mp4", "audio/ogg", "audio/wav"}


class LocalServer(ThreadingHTTPServer):
    def __init__(self, port):
        super().__init__(("127.0.0.1", port), Handler)
        self.host_header = f"127.0.0.1:{self.server_port}"
        self.url = f"http://{self.host_header}"
        self.audio = LocalAudio()
        self.auth_lock = Lock()
        self.model_lock = Lock()
        self.report_lock = Lock()
        self.model = None

    def plan_model(self):
        with self.model_lock:
            if not self.model:
                models = chatgpt.models(teacher.PROFILE)
                choice = next((item for item in models if "luna" in item["slug"]), models[0])
                self.model = choice["slug"]
            return self.model

    def forget_model(self):
        with self.model_lock:
            self.model = None


class Handler(BaseHTTPRequestHandler):
    server_version = "B1Teacher"

    def setup(self):
        self.request.settimeout(15)
        super().setup()

    def log_message(self, *_):
        pass

    def _send(self, status, body, media_type="application/json; charset=utf-8"):
        self.send_response(status)
        self.send_header("Content-Type", media_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; media-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, status, data):
        self._send(status, json.dumps(data, ensure_ascii=False).encode("utf-8"))

    def _error(self, status, message):
        self._json(status, {"error": message})

    def _read(self, limit):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if not 1 <= length <= limit:
            raise teacher.InputError("Die Anfrage ist leer oder zu groß.")
        return self.rfile.read(length)

    def _request_json(self):
        if self.headers.get_content_type() != "application/json":
            raise teacher.InputError("Die Anfrage muss JSON enthalten.")
        try:
            payload = json.loads(self._read(512_000))
        except (UnicodeError, json.JSONDecodeError):
            raise teacher.InputError("Ungültige Anfrage.") from None
        if not isinstance(payload, dict):
            raise teacher.InputError("Ungültige Anfrage.")
        return payload

    def _status(self):
        account = chatgpt.accounts(teacher.PROFILE)
        connected = any(
            item["connected"] and item["client_id"] == account["active"]
            for item in account["accounts"]
        )
        return {"connected": connected, "audioReady": models_ready(), "scenarios": {
            key: {field: item[field] for field in ("label", "opening")}
            for key, item in teacher.SCENARIOS.items()
        }, "reports": teacher.read_journal()}

    def do_GET(self):
        if self.headers.get("Host") != self.server.host_header:
            return self._error(HTTPStatus.FORBIDDEN, "Die App ist nur lokal erreichbar.")
        try:
            if self.path == "/api/status":
                return self._json(HTTPStatus.OK, self._status())
            if asset := ASSETS.get(self.path):
                filename, media_type = asset
                return self._send(HTTPStatus.OK, (PROJECT / "web" / filename).read_bytes(), media_type)
            self._error(HTTPStatus.NOT_FOUND, "Diese Seite wurde nicht gefunden.")
        except (chatgpt.AuthError, OSError, ValueError):
            self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "Der lokale Speicher konnte nicht gelesen werden.")

    def _authenticate(self, reconnect):
        if not self.server.auth_lock.acquire(blocking=False):
            raise teacher.InputError("Eine Anmeldung läuft bereits.")
        try:
            if reconnect:
                saved = chatgpt.accounts(teacher.PROFILE)
                client = saved["active"] or (
                    saved["accounts"][-1]["client_id"] if saved["accounts"] else ""
                )
                chatgpt.sign_in(teacher.PROFILE, client)
                result = {"connected": True}
            else:
                result = {"connected": False, "revoked": chatgpt.sign_out(teacher.PROFILE)}
            self.server.forget_model()
            return result
        finally:
            self.server.auth_lock.release()

    def _turn_or_report(self, payload):
        messages = teacher.conversation(payload)
        if self.path == "/api/turn":
            journal = teacher.read_journal()
            goal = journal[0]["next_goal"] if journal else ""
            return {"reply": teacher.reply(payload, messages, self.server.plan_model(), goal)}
        report_id = teacher.session_id(payload.get("id"))
        with self.server.report_lock:
            for entry in teacher.read_journal():
                if entry["id"] == report_id:
                    return entry
            report = teacher.report(payload, messages, self.server.plan_model())
            return teacher.save_report(report_id, payload["scenario"], report)

    def do_POST(self):
        if self.headers.get("Host") != self.server.host_header or self.headers.get("Origin") != self.server.url:
            return self._error(HTTPStatus.FORBIDDEN, "Anfragen sind nur aus der lokalen App erlaubt.")
        try:
            if self.path == "/api/transcribe":
                if self.headers.get_content_type() not in AUDIO_TYPES:
                    raise teacher.InputError("Das Aufnahmeformat wird nicht unterstützt.")
                text = self.server.audio.transcribe(self._read(MAX_AUDIO))
                return self._json(HTTPStatus.OK, {"text": text[:teacher.MAX_TEXT]})

            payload = self._request_json()
            if self.path == "/api/sign-in":
                result = self._authenticate(reconnect=True)
            elif self.path == "/api/sign-out":
                result = self._authenticate(reconnect=False)
            elif self.path in ("/api/turn", "/api/finish"):
                result = self._turn_or_report(payload)
            elif self.path == "/api/speak":
                text = payload.get("text")
                if not isinstance(text, str) or not 1 <= len(text.strip()) <= teacher.MAX_TEXT:
                    raise teacher.InputError("Der Text für die Sprachausgabe ist ungültig.")
                return self._send(HTTPStatus.OK, self.server.audio.speak(text), "audio/wav")
            else:
                return self._error(HTTPStatus.NOT_FOUND, "Unbekannte Aktion.")
            self._json(HTTPStatus.OK, result)
        except (AudioError, teacher.InputError) as error:
            self._error(HTTPStatus.BAD_REQUEST, str(error))
        except chatgpt.AuthError as error:
            self._error(HTTPStatus.SERVICE_UNAVAILABLE, str(error))
        except (OSError, ValueError, ImportError, RuntimeError, TimeoutError):
            self._error(HTTPStatus.INTERNAL_SERVER_ERROR, "Das hat nicht geklappt. Bitte versuche es erneut.")


def main():
    parser = argparse.ArgumentParser(description="B1 Teacher auf diesem Rechner starten.")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--open", action="store_true", help="Die App im Browser öffnen.")
    args = parser.parse_args()
    with LocalServer(args.port) as server:
        print(f"B1 Teacher läuft auf {server.url}", flush=True)
        if args.open:
            Timer(0.4, webbrowser.open, args=(server.url,)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
