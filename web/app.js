const ui = Object.fromEntries(
  ["account", "connection", "focus", "goal", "scenario-title", "scenario-description",
    "finish", "messages", "record", "draft", "send", "composer-status", "restart",
    "report-empty", "history-label", "history", "report"]
    .map(id => [id, document.getElementById(id)])
);
const scenarioButtons = Array.from(document.querySelectorAll("[data-scenario]"));
const descriptions = {
  alltag: "Erzähl Lucía von deinem Tag und frag sie nach ihrem.",
  verhandlung: "Plant einen Ausflug und einigt euch trotz unterschiedlicher Wünsche."
};
const state = {
  scenario: "alltag", messages: [], reports: [], scenarios: {},
  connected: false, audioReady: false, phase: "loading", finished: false
};
const player = new Audio();
let audioUrl;
let audioVersion = 0;
let recorder;
let recordingTimer;
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
  if (state.messages.length >= maxMessages) return "Beende das Gespräch für deinen Lernbericht.";
  if (!state.audioReady) return "Tippen ist möglich. Für Audio erst setup.ps1 ausführen.";
  if (!window.MediaRecorder || !navigator.mediaDevices?.getUserMedia) return "In diesem Browser kannst du tippen. Für das Mikrofon nutze Edge, Chrome oder Firefox.";
  return "Mikrofon anklicken, sprechen und erneut anklicken. Prüfe den erkannten Satz vor dem Senden.";
}

function updateControls() {
  const idle = state.phase === "idle";
  const canAnswer = idle && state.connected && !state.finished && state.messages.length < maxMessages;
  ui.connection.textContent = state.connected ? "ChatGPT-Abo verbunden" : "Nicht verbunden";
  ui.connection.classList.toggle("connected", state.connected);
  ui.account.textContent = state.phase === "auth" ? "Bitte warte …"
    : state.connected ? "Abmelden" : "Weiter mit ChatGPT";
  ui.account.disabled = !idle || !state.id;
  ui.finish.disabled = !idle || !state.connected || state.finished || state.messages.length < 3;
  ui.draft.disabled = !canAnswer;
  ui.send.disabled = !canAnswer || !ui.draft.value.trim();
  ui.record.disabled = !(state.phase === "recording" || (
    canAnswer && state.audioReady && window.MediaRecorder && navigator.mediaDevices?.getUserMedia
  ));
  const recording = state.phase === "recording";
  ui.record.classList.toggle("recording", recording);
  ui.record.setAttribute("aria-label", recording ? "Aufnahme stoppen" : "Aufnahme starten");
  ui.record.title = ui.record.getAttribute("aria-label");
  ui.restart.hidden = !state.finished;
  scenarioButtons.forEach(button => {
    button.disabled = !idle || !state.id;
    button.classList.toggle("active", button.dataset.scenario === state.scenario);
    button.setAttribute("aria-pressed", button.dataset.scenario === state.scenario);
  });
}

function stopPlayback() {
  audioVersion++;
  player.pause();
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
    audioUrl = undefined;
  }
}

async function listen(text, button) {
  if (!state.audioReady || state.phase !== "idle") return;
  stopPlayback();
  const version = audioVersion;
  if (button) button.disabled = true;
  try {
    const clip = await request("/api/speak", { text });
    if (version !== audioVersion) return;
    audioUrl = URL.createObjectURL(clip);
    player.src = audioUrl;
    await player.play();
  } catch {
    if (version === audioVersion) hint("Audio konnte nicht abgespielt werden. Klicke bei der Nachricht auf Anhören.");
  } finally {
    if (button) button.disabled = false;
  }
}

function drawMessages() {
  ui.messages.replaceChildren();
  for (const message of state.messages) {
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
}

function newConversation(key) {
  stopPlayback();
  state.id = crypto.randomUUID();
  state.scenario = key;
  state.messages = [{ role: "assistant", content: state.scenarios[key].opening }];
  state.finished = false;
  ui["scenario-title"].textContent = state.scenarios[key].label;
  ui["scenario-description"].textContent = descriptions[key];
  ui.draft.value = "";
  drawMessages();
  updateControls();
  hint(readyHint());
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
    const option = element("option", state.scenarios[item.scenario].label + " · " + date);
    option.value = item.id;
    return option;
  }));
  renderReport();
}

async function changeAccount() {
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

async function send() {
  const text = ui.draft.value.trim();
  if (!text || ui.send.disabled) return;
  stopPlayback();
  state.phase = "turn";
  const messages = [...state.messages, { role: "user", content: text }];
  updateControls();
  hint("Lucía antwortet …");
  let answer;
  let failure;
  try {
    const result = await request("/api/turn", { scenario: state.scenario, messages });
    answer = result.reply;
    state.messages = [...messages, { role: "assistant", content: answer }];
    ui.draft.value = "";
    drawMessages();
  } catch (error) {
    failure = error.message;
  } finally {
    state.phase = "idle";
    updateControls();
    hint(failure || readyHint(), Boolean(failure));
  }
  if (answer) void listen(answer);
}

async function finish() {
  stopPlayback();
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

async function record() {
  if (state.phase === "recording") {
    recorder.stop();
    return;
  }
  stopPlayback();
  let stream;
  state.phase = "microphone";
  updateControls();
  hint("Warte auf Mikrofonzugriff …");
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }, video: false
    });
    const type = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"]
      .find(candidate => MediaRecorder.isTypeSupported(candidate));
    recorder = new MediaRecorder(stream, type ? { mimeType: type } : {});
    const chunks = [];
    let recordingFailed = false;
    recorder.addEventListener("dataavailable", event => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("error", () => { recordingFailed = true; });
    recorder.addEventListener("stop", async () => {
      clearTimeout(recordingTimer);
      stream.getTracks().forEach(track => track.stop());
      const clip = new Blob(chunks, { type: recorder.mimeType });
      state.phase = "transcribe";
      updateControls();
      hint("Dein Rechner erkennt den spanischen Text …");
      let failure;
      try {
        if (recordingFailed || !clip.size) throw new Error("Die Aufnahme war leer oder wurde unterbrochen.");
        const result = await request("/api/transcribe", clip);
        if (!result.text) throw new Error("Ich habe keinen Satz erkannt. Versuche es noch einmal.");
        ui.draft.value = [ui.draft.value.trim(), result.text].filter(Boolean).join(" ").slice(0, 1400);
      } catch (error) {
        failure = error.message;
      } finally {
        state.phase = "idle";
        updateControls();
        hint(failure || "Prüfe den erkannten Satz und klicke auf Senden.", Boolean(failure));
        ui.draft.focus();
      }
    }, { once: true });
    recorder.start();
    recordingTimer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, 45000);
    state.phase = "recording";
    updateControls();
    hint("Aufnahme läuft · Klicke erneut, wenn du fertig bist.");
  } catch {
    stream?.getTracks().forEach(track => track.stop());
    state.phase = "idle";
    updateControls();
    hint("Mikrofon nicht verfügbar. Prüfe die Browserberechtigung oder tippe deinen Beitrag.", true);
  }
}

scenarioButtons.forEach(button => button.addEventListener("click", () => {
  if (button.dataset.scenario === state.scenario) return;
  if (!state.finished && (state.messages.length > 1 || ui.draft.value.trim())
      && !window.confirm("Das aktuelle Gespräch ohne Lernbericht verlassen?")) return;
  newConversation(button.dataset.scenario);
}));
ui.account.addEventListener("click", changeAccount);
ui.record.addEventListener("click", record);
ui.send.addEventListener("click", send);
ui.finish.addEventListener("click", finish);
ui.restart.addEventListener("click", () => newConversation(state.scenario));
ui.history.addEventListener("change", renderReport);
ui.draft.addEventListener("input", updateControls);
ui.draft.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    void send();
  }
});

try {
  Object.assign(state, await request("/api/status"));
  state.phase = "idle";
  newConversation(state.scenario);
  drawJournal();
} catch (failure) {
  hint(failure.message + " Lade die Seite neu, sobald der Server läuft.", true);
  ui.connection.textContent = "Lokale Verbindung gestört";
}
