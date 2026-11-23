# B1 Teacher

Ein lokaler Spanischtrainer für Windows. Lucía unterhält sich mit dir auf B1-Niveau. Du kannst frei sprechen, über einen gemeinsamen Ausflug verhandeln oder eine mündliche Prüfungsaufgabe üben.

## Starten

Bei einer neuen Installation brauchst du Python 3.12 (64 Bit) und einen Browser wie Edge, Chrome oder Firefox. Führe einmal im Projektordner aus:

```powershell
powershell -ExecutionPolicy Bypass -File .\setup.ps1
```

Die Einrichtung lädt die Sprachmodelle für Whisper und Piper in den lokalen Projektordner. Wenn der Python-Launcher deine Installation nicht findet, übergib `-Python "C:\Pfad\zu\python.exe"`. Ist die Einrichtung abgeschlossen, öffne `start.cmd`. Die App öffnet sich auf `http://127.0.0.1:8765`. Das Konsolenfenster läuft, solange du die App nutzt.

1. Klicke auf **Weiter mit ChatGPT** und erlaube dem B1 Teacher die Nutzung deines ChatGPT-Abos. Melde dich mit demselben Konto wie im Anki-Add-on an.
2. Wähle **Alltag**, **Verhandlung** oder unter **Prüfungsthemen B1** eine Aufgabe. Klicke einmal auf **Sprachmodus starten**. Nach Lucías Begrüßung kannst du direkt antworten. Nach einer Sprechpause erscheint dein erkannter Beitrag im Verlauf und Lucía antwortet laut. Ihre Antwort schaltet das Mikrofon vorübergehend stumm. Danach hört der Trainer automatisch wieder zu.
3. Im **Live-Transkript** siehst du schon beim Sprechen den vorläufig erkannten Text. Stell unter **Denkpause** ein, wie lange der Trainer auf deinen nächsten Satz warten soll. Wenn du fertig bist, kannst du mit **Direkt senden** sofort abschließen. Klickst du in das Transkript, hält die App den Text fest und wartet auf **Direkt senden**. Sie schickt dann deine korrigierte Fassung ab. Nach Lucías Antwort hört der Sprachmodus wieder zu. Unter **Lautstärke** regelst du Lucías Stimme.
4. Klicke auf **Gespräch beenden**. Die Zusammenfassung, Korrekturen und das Übungsziel erscheinen auf Deutsch. Das Übungsziel fließt in das nächste Gespräch ein.

## Prüfungsthemen

Die zehn Übungsaufgaben decken persönliche Beziehungen, Freizeit, Gesundheit, Wohnen, Reisen, Einkaufen, Umwelt, Lernen, Beruf und Technologie ab. Je nach Thema hältst du einen Kurzvortrag mit Rückfragen, begründest eine Meinung, handelst eine gemeinsame Lösung aus oder sprichst in einem Rollenspiel. Der Lernbericht berücksichtigt die angezeigten Aufgabenpunkte.

Die Aufgaben sind eigens für den Trainer formuliert. Sie orientieren sich an den Kompetenzbeschreibungen und Aufgabenformaten des [Instituto Cervantes](https://examenes.cervantes.es/es/dele/examenes/b1), dem [B1–B2-Themeninventar](https://cvc.cervantes.es/ensenanza/biblioteca_ele/plan_curricular/niveles/09_nociones_especificas_inventario_b1-b2.htm) und [telc Español B1](https://www.telc.net/es/examenes-de-idiomas/examenes-de-certificacion/espanol/telc-espanol-b1/).

## Lesetexte und Gesprächsmodi

Unter **Texte & Gesprächsfragen** stehen die vollständig übernommenen Texte 3 (Redes sociales) und 4 (Universidad e inteligencia artificial) einschließlich jeweils 10 Verständnisfragen, 10 persönlichen Fragen und 8 Debattierfragen zur Auswahl. Der Lesetext und die Fragen lassen sich im Gespräch aufklappen.

- **Basisteil** ist die Voreinstellung: Lucía stellt ausschließlich die 28 Originalfragen in ihrer ursprünglichen Reihenfolge. Der Ablauf wird im Programm festgelegt. Nach der letzten Antwort wird automatisch der Lernbericht erstellt. Über **Gespräch beenden** kannst du schon früher auswerten.
- **Erweiterter Teil** muss für den gewählten Text ausdrücklich ausgewählt werden. Nach den 28 Originalfragen stellt Lucía neue, flexible Fragen zum Text und deinen Antworten. Du beendest das Gespräch selbst; insgesamt sind bis zu 40 Antworten möglich. Ein Moduswechsel beginnt ein neues Gespräch.

Jeder neue Lernbericht enthält zusätzlich die sechs Kriterien der bereitgestellten Bewertungsmatrix mit 0–4 Punkten: Comprensión del texto, Expresión oral, Argumentación, Vocabulario, Corrección gramatical und Interacción. Begründungen und wörtliche Belege begleiten die Punkte. Nicht bewertbare Kriterien erhalten keine Punktzahl und werden nicht in die erreichbare Summe eingerechnet; alle sechs ergeben maximal 24 Punkte. Ohne Lesetext bleibt Textverständnis unbewertet. Die Verständlichkeit wird nur anhand des Textes bzw. Transkripts eingeschätzt, nicht anhand von Aussprache oder Sprechfluss. Alte Lernberichte bleiben lesbar.

Die unveränderten Originalvorlagen liegen in `b1teacher/texts/`. Die dort abweichend nummerierten zweiten Überschriften vor den Fragen werden dem jeweils ersten Titel (Texto 3 bzw. Texto 4) zugeordnet. Beide Vorlagen enthalten dieselben acht Debattierfragen; sie bleiben in beiden Texten erhalten.

## Technisch

- Die App nutzt den offiziellen Anmeldeablauf aus dem Anki Spanish Helper als eigene lokale App-Registrierung. Dialog und Auswertung laufen über dein berechtigtes ChatGPT-Abo innerhalb der Abo-Limits. [Sign in with ChatGPT](https://developers.openai.com/siwc/token-sharing-open-source)
- Whisper und Piper verarbeiten Audio auf deinem Rechner. Im Sprachmodus sendet die App nach der Denkpause oder mit **Direkt senden** den erkannten Text mit dem Gesprächskontext und dem letzten Übungsziel an ChatGPT. Die Optionswerte für diesen Abo-Ablauf sind `store: false` und `stream: true`. [Faster Whisper](https://github.com/SYSTRAN/faster-whisper) · [Piper](https://github.com/OHF-Voice/piper1-gpl) · [Spanisches Stimmmodell](https://huggingface.co/rhasspy/piper-voices/tree/main/es/es_ES/sharvard/medium)
- Die App speichert die Lernberichte einschließlich der zitierten Beispielsätze in `.local/journal.json`. Die Anmeldung wird getrennt vom Anki-Add-on mit Windows DPAPI in `.local/chatgpt/` verschlüsselt. Audio und vollständige Gesprächstranskripte werden nicht gespeichert.
- Bei einem Abo-Limit zeigt die App die Fehlermeldung an. Sie verwendet ausschließlich die ChatGPT-Abo-Anbindung.

## Prüfen

```powershell
.\.venv\Scripts\python.exe -B -m unittest discover -s tests -v
node --check web/app.js
node --test tests/voice.test.mjs
```
