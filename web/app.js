import { VoiceSession } from "./voice.mjs";

const ui = Object.fromEntries(
  ["account", "connection", "focus", "goal", "scenario-title", "scenario-description",
    "exam-topic", "exam-task", "exam-format", "exam-points",
    "reading-topic", "reading-mode", "reading-material", "reading-title", "reading-body", "reading-questions", "reading-progress",
    "finish", "messages", "record", "voice-label", "send-now", "think-time", "volume", "volume-value",
    "voice-preview", "voice-preview-text",
    "draft", "send", "composer-status", "restart",
    "report-empty", "history-label", "history", "report"]
    .map(id => [id, document.getElementById(id)])
);
const scenarioButtons = Array.from(document.querySelectorAll("[data-scenario]"));
const state = {
  scenario: "alltag", messages: [], reports: [], scenarios: {},
  connected: false, audioReady: false, phase: "loading", finished: false, complete: false
};
const player = new Audio();
let audioUrl;
let audioVersion = 0;
let finishPlayback;
let voice;
let openingPlayed = false;
const maxMessages = 81;

async function request(path, body) {
  const options = body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": body instanceof Blob ? body.type : "application/json" },
    body: body instanceof Blob ? body : JSON.stringify(body)
  };
  const response = await fetch(path, options);
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Die lokale App antwortet gerade nicht.");
  }
  return response.headers.get("Content-Type")?.startsWith("audio/")
    ? response.blob() : response.json();
}

function element(tag, text, className) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  if (className) item.className = className;
  return item;
}

function hint(message, error = false) {
  ui["composer-status"].textContent = message;
  ui["composer-status"].classList.toggle("error", error);
}

function readyHint() {
  if (!state.connected) return "Verbinde dein ChatGPT-Konto, um zu starten.";
  if (state.finished) return "Dein Lernbericht ist gespeichert.";
  if (state.complete) return "Alle Originalfragen sind beantwortet. Erstelle deinen Lernbericht über Gespräch beenden.";
  if (state.messages.length >= maxMessages) return "Beende das Gespräch für deinen Lernbericht.";
  if (!state.audioReady) return "Tippen ist möglich. Für Audio erst setup.ps1 ausführen.";
  if (!VoiceSession.supported) return "Für den Sprachmodus öffne die App in Chrome, Edge oder Firefox.";
  if (voice) return "Du bist dran. Lucía antwortet nach einer Sprechpause.";
  return "Starte den Sprachmodus für ein freihändiges Gespräch oder tippe deine Antwort.";
}

function updateControls() {
  const idle = state.phase === "idle";
  const canAnswer = idle && state.connected && !state.finished && !state.complete && state.messages.length < maxMessages;
  ui.connection.textContent = state.connected ? "ChatGPT-Abo verbunden" : "Nicht verbunden";
  ui.connection.classList.toggle("connected", state.connected);
  ui.account.textContent = state.phase === "auth" ? "Bitte warte …"
    : state.connected ? "Abmelden" : "Weiter mit ChatGPT";
  ui.account.disabled = !idle || !state.id;
  ui.finish.disabled = !idle || !state.connected || state.finished || state.messages.length < 3;
  ui.draft.disabled = !canAnswer || Boolean(voice);
  ui.send.disabled = ui.draft.disabled || !ui.draft.value.trim();
  ui.record.disabled = !(voice || (canAnswer && state.audioReady && VoiceSession.supported));
  ui.record.classList.toggle("recording", Boolean(voice));
  ui.record.setAttribute("aria-pressed", Boolean(voice));
  ui["voice-label"].textContent = voice ? "Sprachmodus pausieren" : "Sprachmodus starten";
  updateVoiceEditor();
  ui["think-time"].disabled = !idle;
  ui.volume.disabled = !state.audioReady;
  ui.restart.hidden = !state.finished;
  scenarioButtons.forEach(button => {
    button.disabled = !idle || !state.id;
    button.classList.toggle("active", button.dataset.scenario === state.scenario);
    button.setAttribute("aria-pressed", button.dataset.scenario === state.scenario);
  });
  const examSelected = Boolean(state.scenarios[state.scenario]?.area);
  ui["exam-topic"].disabled = !idle || !state.id;
  ui["exam-topic"].value = examSelected ? state.scenario : "";
  ui["exam-topic"].classList.toggle("active", examSelected);
  const topic = state.scenarios[state.scenario];
  ui["reading-topic"].disabled = !idle || !state.id;
  ui["reading-topic"].value = topic?.reading?.number || "";
  ui["reading-mode"].disabled = !idle || !state.id || !topic?.reading;
  ui["reading-mode"].value = topic?.mode || "basico";
}

function updateVoiceEditor() {
  const capturing = state.phase === "voice-input";
  const editing = state.phase === "voice-edit";
  const preview = ui["voice-preview-text"];
  const hasText = Boolean(preview.value.trim());
  ui["voice-preview"].hidden = !(capturing || editing || state.phase === "transcribe");
  preview.disabled = !(editing || (capturing && hasText));
  ui["send-now"].hidden = !voice;
  ui["send-now"].disabled = !voice || !(capturing || (editing && hasText));
}

function showVoicePreview(text) {
  const preview = ui["voice-preview-text"];
  preview.value = text;
  preview.scrollTop = preview.scrollHeight;
  updateVoiceEditor();
}

function applyVolume() {
  const percent = ui.volume.valueAsNumber;
  player.volume = percent / 100;
  ui["volume-value"].value = percent + " %";
  ui.volume.setAttribute("aria-valuetext", percent + " Prozent");
}

function stopPlayback() {
  audioVersion++;
  finishPlayback?.();
  player.pause();
  if (audioUrl) {
    player.removeAttribute("src");
    URL.revokeObjectURL(audioUrl);
    audioUrl = undefined;
  }
}

async function listen(text, button) {
  if (!state.audioReady || state.phase !== "idle") return;
  stopPlayback();
  const version = audioVersion;
  state.phase = "speaking";
  voice?.setListening(false);
  updateControls();
  hint("Lucía spricht …");
  if (button) button.disabled = true;
  let problem;
  try {
    const clip = await request("/api/speak", { text });
    if (version !== audioVersion) return;
    audioUrl = URL.createObjectURL(clip);
    player.src = audioUrl;
    await new Promise((resolve, reject) => {
      let settled = false;
      const done = () => settle();
      const failed = () => settle(new Error("Audio konnte nicht abgespielt werden."));
      const settle = error => {
        if (settled) return;
        settled = true;
        player.removeEventListener("ended", done);
        player.removeEventListener("error", failed);
        finishPlayback = undefined;
        if (error) reject(error);
        else resolve();
      };
      finishPlayback = done;
      player.addEventListener("ended", done);
      player.addEventListener("error", failed);
      player.play().catch(settle);
    });
    if (version === audioVersion && text === state.messages[0].content) openingPlayed = true;
  } catch {
    if (version === audioVersion) problem = "Audio konnte nicht abgespielt werden. Versuche es über Anhören erneut.";
  } finally {
    if (button) button.disabled = false;
    if (version === audioVersion) stopPlayback();
    state.phase = "idle";
    resumeListening(problem, Boolean(problem));
  }
}

function resumeListening(message, error = false) {
  if (voice && (state.complete || state.messages.length >= maxMessages)) closeVoice();
  if (state.phase === "idle") voice?.setListening(true);
  updateControls();
  hint(message || readyHint(), error);
}

function closeVoice() {
  const session = voice;
  voice = undefined;
  session?.close();
}

function drawMessages(pendingText) {
  ui.messages.replaceChildren();
  const messages = pendingText ? [...state.messages, { role: "user", content: pendingText }] : state.messages;
  for (const message of messages) {
    const fromUser = message.role === "user";
    const row = element("li", "", "message " + message.role);
    const meta = element("div", fromUser ? "Du" : "Lucía", "message-meta");
    if (!fromUser && state.audioReady) {
      const play = element("button", "Anhören", "listen");
      play.type = "button";
      play.addEventListener("click", () => listen(message.content, play));
      meta.append(play);
    }
    const bubble = element("p", message.content, "bubble");
    bubble.lang = "es";
    row.append(meta, bubble);
    ui.messages.append(row);
  }
  ui.messages.scrollTop = ui.messages.scrollHeight;
  const topic = state.scenarios[state.scenario];
  ui["reading-progress"].hidden = !topic?.reading;
  if (topic?.reading) {
    const answered = state.messages.filter(message => message.role === "user").length;
    const count = topic.reading.questions.length;
    ui["reading-progress"].textContent = answered < count
      ? `${topic.mode === "basico" ? "Basisteil" : "Erweiterter Teil"} · Frage ${answered + 1} von ${count}`
      : topic.mode === "basico" ? "Alle 28 Originalfragen beantwortet"
      : `Erweiterter Teil · freie Anschlussfragen (${answered - count} beantwortet)`;
  }
}

function newConversation(key) {
  stopPlayback();
  closeVoice();
  openingPlayed = false;
  const topic = state.scenarios[key];
  state.id = crypto.randomUUID();
  state.scenario = key;
  state.messages = [{ role: "assistant", content: topic.opening }];
  state.finished = false;
  state.complete = false;
  ui["scenario-title"].textContent = topic.label;
  ui["scenario-description"].textContent = topic.description;
  ui["exam-task"].hidden = !topic.points;
  ui["exam-format"].textContent = topic.format || "";
  ui["exam-points"].replaceChildren(...(topic.points || []).map(point => element("li", point)));
  ui["reading-material"].hidden = !topic.reading;
  ui["reading-material"].open = Boolean(topic.reading);
  ui["reading-title"].textContent = topic.reading?.title || "";
  ui["reading-body"].replaceChildren(...(topic.reading?.body.split(/\n\s*\n/) || [])
    .map(paragraph => element("p", paragraph)));
  ui["reading-questions"].replaceChildren(...(topic.reading?.groups || []).map(group => {
    const block = element("section");
    const list = element("ol");
    list.append(...group.questions.map(question => element("li", question)));
    block.append(element("h4", group.label), list);
    return block;
  }));
  ui.draft.value = "";
  drawMessages();
  updateControls();
  hint(readyHint());
}

function populateExamTopics() {
  const groups = new Map();
  for (const [key, topic] of Object.entries(state.scenarios)) {
    if (!topic.area) continue;
    if (!groups.has(topic.area)) {
      const group = document.createElement("optgroup");
      group.label = topic.area;
      groups.set(topic.area, group);
      ui["exam-topic"].append(group);
    }
    const option = element("option", topic.label);
    option.value = key;
    groups.get(topic.area).append(option);
  }
}

function renderReport() {
  const report = state.reports.find(item => item.id === ui.history.value);
  ui.report.replaceChildren();
  ui.report.hidden = !report;
  if (!report) return;
  const section = (title, ...children) => {
    const block = element("section", "", "report-section");
    block.append(element("h3", title), ...children);
    ui.report.append(block);
  };
  section("Gespräch", element("p", report.summary));
  if (report.evaluation) {
    const table = element("table", "", "evaluation-table");
    const header = element("tr");
    for (const title of ["Kriterium", "Punkte"]) {
      const cell = element("th", title);
      cell.scope = "col";
      header.append(cell);
    }
    const head = element("thead");
    head.append(header);
    const body = element("tbody");
    for (const criterion of report.evaluation.criteria) {
      const row = element("tr");
      const name = element("th", criterion.label);
      name.scope = "row";
      name.lang = "es";
      const detail = element("tr", "", "evaluation-detail");
      const explanation = element("td");
      explanation.colSpan = 2;
      explanation.append(element("strong", criterion.descriptor), element("p", criterion.reason));
      if (criterion.evidence) {
        const quote = element("q", criterion.evidence);
        quote.lang = "es";
        explanation.append(quote);
      }
      row.append(name, element("td", criterion.score === null ? "—" : `${criterion.score}/4`));
      detail.append(explanation);
      body.append(row, detail);
    }
    table.append(head, body);
    const { total, maximum } = report.evaluation;
    section("Bewertung", element("p", maximum ? `${total} / ${maximum} Punkte${maximum < 24 ? " (bewertbare Kriterien)" : ""}` : "Noch keine Kriterien bewertbar."),
      table, element("p", "— = nicht bewertbar. Bewertung anhand deiner Texteingaben bzw. des Transkripts. Mündliche Verständlichkeit ist eine vorläufige Einschätzung; Aussprache und Sprechfluss werden nicht gemessen."));
  }
  section("Das lief gut", element("p", report.strength));
  const corrections = report.corrections.map(correction => {
    const block = element("div", "", "correction");
    const original = element("del", correction.original);
    const corrected = element("strong", correction.corrected);
    original.lang = corrected.lang = "es";
    block.append(original, corrected, element("p", correction.explanation));
    return block;
  });
  section("Korrekturen", ...(corrections.length ? corrections : [
    element("p", "In diesem Gespräch wurden keine eindeutigen Fehler festgestellt.")
  ]));
  section("Nächstes Mal", element("p", report.next_goal), element("p", report.practice));
}

function drawJournal() {
  const latest = state.reports[0];
  ui["report-empty"].hidden = Boolean(latest);
  ui["history-label"].hidden = ui.history.hidden = !latest;
  ui.focus.hidden = !latest;
  ui.goal.textContent = latest?.next_goal || "";
  ui.history.replaceChildren(...state.reports.map(item => {
    const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" })
      .format(new Date(item.created_at));
    const label = state.scenarios[item.scenario]?.label || item.scenario;
    const option = element("option", label + " · " + date);
    option.value = item.id;
    return option;
  }));
  renderReport();
}

async function changeAccount() {
  closeVoice();
  state.phase = "auth";
  updateControls();
  if (!state.connected) hint("Erlaube dem B1 Teacher die Nutzung deines Abos im Browser.");
  let message;
  let error = false;
  try {
    const result = await request(state.connected ? "/api/sign-out" : "/api/sign-in", {});
    state.connected = result.connected;
    if (result.revoked === false) {
      message = "Lokal abgemeldet. Entferne die Verbindung bei Bedarf in deinen ChatGPT-Einstellungen.";
    }
  } catch (failure) {
    message = failure.message;
    error = true;
  } finally {
    state.phase = "idle";
    updateControls();
    hint(message || readyHint(), error);
  }
}

async function sendText(text, voiceTurn) {
  stopPlayback();
  state.phase = "turn";
  const messages = [...state.messages, { role: "user", content: text }];
  drawMessages(text);
  updateControls();
  hint("Lucía antwortet …");
  let answer;
  let failure;
  try {
    const result = await request("/api/turn", { scenario: state.scenario, messages });
    answer = result.reply;
    state.complete = Boolean(result.complete);
    state.messages = [...messages, { role: "assistant", content: answer }];
    ui.draft.value = "";
    drawMessages();
  } catch (error) {
    failure = error.message;
    drawMessages();
    if (voiceTurn) {
      closeVoice();
      ui.draft.value = text;
    }
  } finally {
    state.phase = "idle";
  }
  if (answer && (!voiceTurn || voice === voiceTurn) && state.audioReady) {
    await listen(answer);
  } else {
    resumeListening(failure, Boolean(failure));
  }
  if (state.complete && !failure) await finish();
}

function send() {
  if (!ui.send.disabled) void sendText(ui.draft.value.trim());
}

async function finish() {
  stopPlayback();
  closeVoice();
  state.phase = "report";
  updateControls();
  hint("Dein Lernbericht wird erstellt …");
  let failure;
  try {
    const report = await request("/api/finish", {
      id: state.id, scenario: state.scenario, messages: state.messages
    });
    state.reports = [report, ...state.reports.filter(item => item.id !== report.id)];
    state.finished = true;
    drawJournal();
    ui.report.scrollIntoView({ block: "nearest" });
  } catch (error) {
    failure = error.message;
  } finally {
    state.phase = "idle";
    updateControls();
    hint(failure || readyHint(), Boolean(failure));
  }
}

async function finishVoiceTurn(session, sendWhenReady, deviceLost = false) {
  if (!session || session !== voice || state.phase !== "voice-input") return;
  state.phase = "transcribe";
  const pending = session.takeTranscript();
  session.setListening(false);
  if (!sendWhenReady) closeVoice();
  updateControls();
  hint("Dein Rechner erkennt den spanischen Text …");
  const { text, error } = await pending;
  if (voice === session && text && !error) {
    await sendText(text, session);
    return;
  }
  if (text) ui.draft.value = [ui.draft.value.trim(), text].filter(Boolean).join(" ");
  if (error) closeVoice();
  state.phase = "idle";
  const message = error ? "Ein Teil der Aufnahme konnte nicht erkannt werden. Prüfe den erkannten Text."
    : deviceLost ? "Die Mikrofonverbindung wurde unterbrochen."
    : sendWhenReady && voice ? "Ich habe keinen Satz verstanden. Du bist weiter dran."
    : text ? "Der erkannte Satz steht zum Bearbeiten im Textfeld." : undefined;
  resumeListening(message, Boolean(error || deviceLost));
}

function editVoiceTurn() {
  if (!voice || state.phase !== "voice-input") return;
  state.phase = "voice-edit";
  voice.discardTurn();
  updateControls();
  hint("Korrigiere den Text. Er wartet auf „Direkt senden“.");
}

function sendVoiceTurn() {
  if (ui["send-now"].disabled) return;
  if (state.phase === "voice-edit") {
    void sendText(ui["voice-preview-text"].value.trim(), voice);
  } else {
    void finishVoiceTurn(voice, true);
  }
}

function keepVoiceEditAsDraft(message, error = false) {
  ui.draft.value = ui["voice-preview-text"].value;
  closeVoice();
  state.phase = "idle";
  resumeListening(message, error);
}

async function toggleVoice() {
  if (voice) {
    if (state.phase === "voice-input") {
      await finishVoiceTurn(voice, false);
    } else if (state.phase === "voice-edit") {
      keepVoiceEditAsDraft("Dein Text steht jetzt im Eingabefeld.");
    } else {
      closeVoice();
      stopPlayback();
      updateControls();
      if (state.phase === "idle") hint(readyHint());
    }
    return;
  }
  if (ui.draft.value.trim()) {
    hint("Sende oder leere zuerst deinen Textentwurf.");
    return;
  }
  stopPlayback();
  state.phase = "microphone";
  updateControls();
  hint("Warte auf Mikrofonzugriff …");
  try {
    let session;
    session = await VoiceSession.open({
      pauseSeconds: Number(ui["think-time"].value),
      transcribe: clip => request("/api/transcribe", clip),
      onStart: () => {
        state.phase = "voice-input";
        showVoicePreview("");
        updateControls();
        hint("Ich höre dir zu …");
      },
      onPreview: text => {
        if (voice === session && state.phase === "voice-input") showVoicePreview(text);
      },
      onEnd: () => { void finishVoiceTurn(session, true); },
      onDisconnect: () => {
        if (voice !== session) return;
        if (state.phase === "voice-input") {
          void finishVoiceTurn(session, false, true);
        } else if (state.phase === "voice-edit") {
          keepVoiceEditAsDraft("Die Mikrofonverbindung wurde unterbrochen. Dein Text steht im Eingabefeld.", true);
        } else {
          closeVoice();
          updateControls();
          hint("Die Mikrofonverbindung wurde unterbrochen.", true);
        }
      }
    });
    voice = session;
    state.phase = "idle";
    if (!openingPlayed && state.messages.length === 1) await listen(state.messages[0].content);
    else resumeListening();
  } catch {
    state.phase = "idle";
    resumeListening("Mikrofon nicht verfügbar. Prüfe die Browserberechtigung oder tippe deinen Beitrag.", true);
  }
}

function chooseScenario(key) {
  if (key === state.scenario || !state.scenarios[key]) return;
  if (!state.finished && (state.messages.length > 1 || ui.draft.value.trim())
      && !window.confirm("Das aktuelle Gespräch ohne Lernbericht verlassen?")) {
    updateControls();
    return;
  }
  newConversation(key);
}

scenarioButtons.forEach(button => button.addEventListener("click", () => chooseScenario(button.dataset.scenario)));
ui["exam-topic"].addEventListener("change", () => chooseScenario(ui["exam-topic"].value));
ui["reading-topic"].addEventListener("change", () => {
  // A new text always starts in basic mode; extension requires an explicit choice.
  chooseScenario(`texto-${ui["reading-topic"].value}-basico`);
});
ui["reading-mode"].addEventListener("change", () => {
  const number = state.scenarios[state.scenario]?.reading?.number;
  if (number) chooseScenario(`texto-${number}-${ui["reading-mode"].value}`);
});
ui.account.addEventListener("click", changeAccount);
ui.record.addEventListener("click", toggleVoice);
ui["send-now"].addEventListener("click", sendVoiceTurn);
ui["voice-preview-text"].addEventListener("focus", editVoiceTurn);
ui["voice-preview-text"].addEventListener("input", updateVoiceEditor);
ui["think-time"].addEventListener("change", () => {
  if (voice) voice.detector.pauseSeconds = Number(ui["think-time"].value);
});
try {
  const saved = localStorage.getItem("b1teacher.volume");
  if (saved !== null) ui.volume.value = saved;
} catch {
  // Audio can still be adjusted when browser storage is unavailable.
}
applyVolume();
ui.volume.addEventListener("input", () => {
  applyVolume();
  try {
    localStorage.setItem("b1teacher.volume", ui.volume.value);
  } catch {
    // Use the setting for this page when browser storage is unavailable.
  }
});
ui.send.addEventListener("click", send);
ui.finish.addEventListener("click", finish);
ui.restart.addEventListener("click", () => newConversation(state.scenario));
ui.history.addEventListener("change", renderReport);
ui.draft.addEventListener("input", updateControls);
ui.draft.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    send();
  }
});

try {
  Object.assign(state, await request("/api/status"));
  state.phase = "idle";
  populateExamTopics();
  newConversation(state.scenario);
  drawJournal();
} catch (failure) {
  hint(failure.message + " Lade die Seite neu, sobald der Server läuft.", true);
  ui.connection.textContent = "Lokale Verbindung gestört";
}
