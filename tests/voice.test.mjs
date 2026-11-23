import assert from "node:assert/strict";
import test from "node:test";
import { SpeechTurn, VoiceSession, joinTranscript, pcmWav } from "../web/voice.mjs";

function simulate(pauseSeconds) {
  const events = [];
  const detector = new SpeechTurn(pauseSeconds, {
    onStart: () => events.push({ kind: "start" }),
    onPiece: (frames, overlap) => events.push({ kind: "piece", length: frames.length, overlap }),
    onEnd: () => events.push({ kind: "end" })
  });
  const voice = new Float32Array([0.03, -0.03]);
  const quiet = new Float32Array([0.001, -0.001]);
  return {
    events,
    speak: seconds => { for (let frame = 0; frame < seconds * 20; frame++) detector.push(voice); },
    pause: seconds => { for (let frame = 0; frame < seconds * 20; frame++) detector.push(quiet); }
  };
}

test("waits without a timeout and keeps thought pauses within the same turn", () => {
  const input = simulate(8);
  input.pause(120);
  input.speak(0.05);
  input.pause(1);
  assert.deepEqual(input.events, []);
  input.speak(1);
  input.pause(6);
  input.speak(1);
  assert.deepEqual(input.events, [{ kind: "start" }]);
  input.pause(8);
  assert.deepEqual(input.events.map(event => event.kind), ["start", "piece", "end"]);
  input.speak(1);
  input.pause(8);
  assert.equal(input.events.filter(event => event.kind === "end").length, 2);
});

test("transcribes continuous speech in overlapping pieces without ending the turn", () => {
  const input = simulate(4);
  input.speak(95);
  assert.deepEqual(input.events.map(event => event.kind), ["start", "piece", "piece", "piece"]);
  input.pause(4);
  const pieces = input.events.filter(event => event.kind === "piece");
  assert.deepEqual(pieces.map(piece => piece.overlap), [false, true, true, true]);
  assert.ok(pieces.every(piece => piece.length <= 600));
  assert.equal(pieces.reduce((frames, piece) => frames + piece.length, 0) - 3 * 18, 95 * 20 + 7);
  assert.equal(input.events.at(-1).kind, "end");
});

test("splits at a natural pause without submitting silence or duplicating words", () => {
  const input = simulate(4);
  input.speak(25);
  input.pause(0.25);
  assert.equal(input.events.filter(event => event.kind === "piece").length, 1);
  input.pause(4);
  assert.deepEqual(input.events.map(event => event.kind), ["start", "piece", "end"]);
  assert.equal(joinTranscript("Mañana vamos al", "Al museo.", true), "Mañana vamos al museo.");
  assert.equal(joinTranscript("Sí.", "Sí, claro.", false), "Sí. Sí, claro.");
});

test("encodes mono PCM accepted by the local speech recognizer", async () => {
  const clip = pcmWav([new Float32Array([-1, 0, 1])], 16000);
  const bytes = new DataView(await clip.arrayBuffer());
  assert.equal(clip.type, "audio/wav");
  assert.equal(bytes.getUint32(24, true), 16000);
  assert.equal(bytes.getUint32(40, true), 6);
  assert.equal(bytes.getInt16(44, true), -32768);
  assert.equal(bytes.getInt16(48, true), 32767);
});

test("shows provisional text and reuses it when sending the same audio", async t => {
  const connect = target => target;
  class FakeAudioWorklet {
    port = {};
    connect = connect;
  }
  const originalWorklet = globalThis.AudioWorkletNode;
  globalThis.AudioWorkletNode = FakeAudioWorklet;
  t.after(() => {
    if (originalWorklet === undefined) delete globalThis.AudioWorkletNode;
    else globalThis.AudioWorkletNode = originalWorklet;
  });
  const track = { addEventListener() {} };
  const previews = [];
  const transcribe = t.mock.fn(async () => ({ text: "Hola, Lucía." }));
  const session = new VoiceSession({
    sampleRate: 16000,
    createMediaStreamSource: () => ({ connect }),
    createBiquadFilter: () => ({ frequency: {}, connect }),
    destination: {}
  }, { getAudioTracks: () => [track] }, {
    pauseSeconds: 12, transcribe, onStart() {}, onEnd() {}, onPreview: text => previews.push(text)
  });
  session.setListening(true);
  for (let index = 0; index < 16; index++) {
    session.node.port.onmessage({ data: new Float32Array([0.04, -0.04]) });
  }
  await session.previewInFlight;
  assert.deepEqual(previews, ["Hola, Lucía."]);
  const sent = session.takeTranscript();
  session.setListening(false);
  assert.deepEqual(await sent, { text: "Hola, Lucía.", error: undefined });
  assert.equal(transcribe.mock.callCount(), 1);
  assert.deepEqual(previews, ["Hola, Lucía."]);
});
