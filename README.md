# B1 Teacher

Ein lokaler Spanischtrainer für Windows. Lucía unterhält sich mit dir auf B1-Niveau. Du erzählst von deinem Tag oder verhandelst über einen gemeinsamen Ausflug.

## Starten

Bei einer neuen Installation brauchst du Python 3.12 (64 Bit) und einen Browser wie Edge, Chrome oder Firefox. Führe einmal im Projektordner aus:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Die Einrichtung lädt die Sprachmodelle für Whisper und Piper in den lokalen Projektordner. Wenn der Python-Launcher deine Installation nicht findet, übergib `-Python "C:\Pfad\zu\python.exe"`. Ist die Einrichtung abgeschlossen, öffne `start.cmd`. Die App öffnet sich auf `http://127.0.0.1:8765`. Das Konsolenfenster läuft, solange du die App nutzt.

1. Klicke auf **Weiter mit ChatGPT** und erlaube dem B1 Teacher die Nutzung deines ChatGPT-Abos. Melde dich mit demselben Konto wie im Anki-Add-on an.
2. Wähle **Alltag** oder **Verhandlung**. Klicke auf das Mikrofon, sprich bis zu 45 Sekunden Spanisch und klicke erneut. Prüfe den erkannten Text und bestätige ihn mit **Senden**. Du kannst auch direkt tippen.
3. Klicke auf **Gespräch beenden**. Die Zusammenfassung, Korrekturen und das Übungsziel erscheinen auf Deutsch. Das Übungsziel fließt in das nächste Gespräch ein.

## Technisch

- Die App nutzt den offiziellen Anmeldeablauf aus dem Anki Spanish Helper als eigene lokale App-Registrierung. Dialog und Auswertung laufen über dein berechtigtes ChatGPT-Abo innerhalb der Abo-Limits. [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source)
- Whisper und Piper verarbeiten Audio auf deinem Rechner. ChatGPT erhält den bestätigten Text, den Gesprächskontext und das letzte Übungsziel. Die Optionswerte für diesen Abo-Ablauf sind `store: false` und `stream: true`. [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) · [Piper](https://github.com/OHF-Voice/piper1-gpl) · [Spanisches Stimmmodell](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/sharvard/medium)
- Die App speichert die Lernberichte einschließlich der zitierten Beispielsätze in `.local/journal.json`. Die Anmeldung wird getrennt vom Anki-Add-on mit Windows DPAPI in `.local/chatgpt/` verschlüsselt. Audio und vollständige Gesprächstranskripte werden nicht gespeichert.
- Bei einem Abo-Limit zeigt die App die Fehlermeldung an. Sie verwendet ausschließlich die ChatGPT-Abo-Anbindung.

## Prüfen

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node --check web/app.js
```
