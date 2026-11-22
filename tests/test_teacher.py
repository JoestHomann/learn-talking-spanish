import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4

from b1teacher import chatgpt, teacher
from b1teacher.__main__ import LocalServer


def model_response(text):
    return json.dumps({"output": [{"type": "message", "role": "assistant", "content": [
        {"type": "output_text", "text": text}
    ]}]}).encode(), "application/json"


class TeacherTest(unittest.TestCase):
    def test_dialog_report_and_next_goal_via_local_server(self):
        with TemporaryDirectory() as folder, LocalServer(0) as server:
            journal = Path(folder) / "journal.json"
            worker = Thread(target=server.serve_forever, daemon=True)
            worker.start()

            def post(path, body, origin=None):
                request = Request(server.url + path, data=json.dumps(body).encode(), headers={
                    "Origin": origin or server.url, "Content-Type": "application/json"
                })
                with urlopen(request, timeout=5) as response:
                    return json.load(response)

            opening = teacher.SCENARIOS["verhandlung"]["opening"]
            learner = "Te propongo que salimos a las once."
            reply = "¿Que salgamos a las once? A esa hora puedo. ¿Qué hacemos si llueve?"
            data = {
                "summary": "Ihr habt einen Samstagsausflug geplant.",
                "strength": "Du hast einen konkreten Vorschlag gemacht.",
                "next_goal": "Vorschläge mit te propongo que bilden.",
                "practice": "Schlage eine Aktivität für Sonntag vor.",
                "corrections": [
                    {"original": learner, "corrected": "Te propongo que salgamos a las once.",
                     "explanation": "Bei diesem Vorschlag folgt der Subjuntivo."},
                    {"original": "No existe en la conversación", "corrected": "No existe.",
                     "explanation": "Nicht belegte Korrektur."},
                ],
            }
            payload = {"id": str(uuid4()), "scenario": "verhandlung", "messages": [
                {"role": "assistant", "content": opening}, {"role": "user", "content": learner}
            ]}
            try:
                with (patch.object(teacher, "JOURNAL", journal), patch.object(teacher, "DATA", Path(folder)),
                      patch.object(chatgpt, "models", return_value=[
                          {"slug": "test-sol"}, {"slug": "test-luna"}
                      ]), patch.object(chatgpt, "response", side_effect=[
                          model_response(reply), model_response(json.dumps(data)), model_response(reply)
                      ]) as request):
                    with self.assertRaises(HTTPError) as foreign:
                        post("/api/turn", payload, "https://example.invalid")
                    self.assertEqual(foreign.exception.code, 403)
                    self.assertEqual(request.call_count, 0)
                    self.assertEqual(post("/api/turn", payload)["reply"], reply)
                    self.assertEqual(request.call_args.args[1]["model"], "test-luna")
                    payload["messages"].append({"role": "assistant", "content": reply})
                    report = post("/api/finish", payload)
                    self.assertEqual(report["corrections"], data["corrections"][:1])
                    self.assertEqual(post("/api/finish", payload), report)
                    self.assertEqual(request.call_count, 2)
                    self.assertEqual(json.loads(journal.read_text(encoding="utf-8")), [report])
                    self.assertNotIn("messages", report)
                    payload["messages"].pop()
                    post("/api/turn", payload)
                    self.assertIn(data["next_goal"], request.call_args.args[1]["instructions"])
            finally:
                server.shutdown()
                worker.join()

    def test_plan_only_response_protocol(self):
        class Stream:
            def __enter__(self):
                return iter((
                    b'data: {"type":"response.output_text.done","output_index":0,"content_index":0,"text":"Hola"}\n',
                    b'\n',
                    b'data: {"type":"response.completed","response":{"status":"completed","output":[]}}\n',
                    b'\n',
                ))

            def __exit__(self, *_):
                pass

        with (patch.object(chatgpt, "_access", return_value="test-oauth-token"),
              patch.object(chatgpt, "urlopen", return_value=Stream()) as transport):
            result = teacher.request_text("test-model", "Responde en español.", [
                {"role": "user", "content": "Hola"}
            ])
        sent = transport.call_args.args[0]
        body = json.loads(sent.data)
        self.assertEqual(result, "Hola")
        self.assertEqual(sent.full_url, "https://api.openai.com/v1/responses")
        self.assertEqual(sent.get_header("Authorization"), "Bearer test-oauth-token")
        self.assertTrue(body["stream"])
        self.assertFalse(body["store"])


if __name__ == "__main__":
    unittest.main()
