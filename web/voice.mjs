const framesPerSecond = 20;
const preRoll = 7;
const onset = 3;
const chunkTarget = 24 * framesPerSecond;
const chunkLimit = 30 * framesPerSecond;
const splitPause = 5;
const chunkOverlap = 18;
const previewMinimum = 16;
const previewStep = 24;

export class SpeechTurn {
  constructor(pauseSeconds, { onStart, onPiece, onEnd }) {
    this.pauseSeconds = pauseSeconds;
    this.onStart = onStart;
    this.onPiece = onPiece;
    this.onEnd = onEnd;
    this.noise = 0.002;
    this.reset();
  }

  reset() {
    this.active = false;
    this.frames = [];
    this.overlap = false;
    this.freshSpeech = false;
    this.speechRun = 0;
    this.silentFrames = 0;
  }

  push(frame) {
    let squares = 0;
    for (const sample of frame) squares += sample * sample;
    const level = Math.sqrt(squares / frame.length);
    const threshold = Math.max(0.006, Math.min(0.05, this.noise * 3));
    const voiced = level >= threshold;
    if (!voiced) this.noise += (level - this.noise) * 0.035;

    this.frames.push(frame);
    if (!this.active) {
      if (this.frames.length > preRoll) this.frames.shift();
      this.speechRun = voiced ? this.speechRun + 1 : 0;
      if (this.speechRun >= onset) {
        this.active = true;
        this.freshSpeech = true;
        this.onStart();
      }
      return;
    }

    this.silentFrames = voiced ? 0 : this.silentFrames + 1;
    this.freshSpeech ||= voiced;
    if (this.silentFrames >= this.pauseSeconds * framesPerSecond) {
      this.finish();
      this.onEnd();
    } else if (this.frames.length >= chunkTarget && this.silentFrames >= splitPause) {
      this.split(0);
    } else if (this.frames.length >= chunkLimit) {
      this.split(chunkOverlap);
    }
  }

  split(keep) {
    this.onPiece(this.frames, this.overlap);
    // Keep part of a word when a long stretch has no quiet place to split.
    this.frames = keep ? this.frames.slice(-keep) : [];
    this.overlap = keep > 0;
    this.freshSpeech = false;
  }

  currentLength() {
    if (!this.active || !this.freshSpeech) return 0;
    const length = this.frames.length - Math.max(0, this.silentFrames - preRoll);
    return length > (this.overlap ? chunkOverlap : 0) ? length : 0;
  }

  finish() {
    const length = this.currentLength();
    if (length) this.onPiece(this.frames.slice(0, length), this.overlap);
    this.reset();
  }
}

export function pcmWav(frames, sampleRate) {
  const samples = frames.reduce((total, frame) => total + frame.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  for (const [offset, label] of [[0, "RIFF"], [8, "WAVEfmt "], [36, "data"]]) {
    for (let index = 0; index < label.length; index++) view.setUint8(offset + index, label.charCodeAt(index));
  }
  view.setUint32(4, buffer.byteLength - 8, true);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (const frame of frames) {
    for (const value of frame) {
      const sample = Math.max(-1, Math.min(1, value));
      view.setInt16(offset, sample * (sample < 0 ? 32768 : 32767), true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function token(word) {
  return word.toLocaleLowerCase("es").replace(/[^\p{L}\p{N}]/gu, "");
}

export function joinTranscript(previous, text, overlap) {
  if (!previous || !text || !overlap) return [previous, text].filter(Boolean).join(" ");
  const left = previous.split(/\s+/);
  const right = text.split(/\s+/);
  for (let length = Math.min(5, left.length, right.length); length > 0; length--) {
    if (left.slice(-length).every((word, index) => token(word) && token(word) === token(right[index]))) {
      return [previous, ...right.slice(length)].join(" ");
    }
  }
  return previous + " " + text;
}

export class VoiceSession {
  static get supported() {
    return Boolean(window.AudioContext && window.AudioWorkletNode && navigator.mediaDevices?.getUserMedia);
  }

  static async open(options) {
    const context = new AudioContext({ sampleRate: 16000 });
    let stream;
    try {
      await context.resume();
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false
      });
      await context.audioWorklet.addModule("/microphone.js");
      return new VoiceSession(context, stream, options);
    } catch (error) {
      stream?.getTracks().forEach(track => track.stop());
      void context.close().catch(() => {});
      throw error;
    }
  }

  constructor(context, stream, { pauseSeconds, transcribe, onStart, onEnd, onPreview, onDisconnect }) {
    this.context = context;
    this.stream = stream;
    this.transcribe = transcribe;
    this.onPreview = onPreview;
    this.pending = Promise.resolve();
    this.pieces = [];
    this.pendingPieces = 0;
    this.turnVersion = 0;
    this.completedText = "";
    this.listening = false;
    this.detector = new SpeechTurn(pauseSeconds, {
      onStart,
      onPiece: (frames, overlap) => this.transcribePiece(frames, overlap),
      onEnd
    });
    this.source = context.createMediaStreamSource(stream);
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 100;
    this.node = new AudioWorkletNode(context, "microphone-frames", { channelCount: 1, channelCountMode: "explicit" });
    this.source.connect(filter).connect(this.node).connect(context.destination);
    this.node.port.onmessage = ({ data }) => {
      if (!this.listening) return;
      this.detector.push(data);
      this.previewCurrentPiece();
    };
    this.node.onprocessorerror = onDisconnect;
    stream.getAudioTracks().forEach(track => track.addEventListener("ended", onDisconnect, { once: true }));
    this.setListening(false);
  }

  setListening(listening) {
    this.listening = listening;
    this.stream.getAudioTracks().forEach(track => { track.enabled = listening; });
    if (!listening) {
      this.turnVersion++;
      this.completedText = "";
      this.preview = undefined;
      this.detector.reset();
    }
  }

  async recognize(frames) {
    try {
      const { text } = await this.transcribe(pcmWav(frames, this.context.sampleRate));
      return { text: text.trim() };
    } catch (error) {
      return { error: error.message };
    }
  }

  previewCurrentPiece() {
    if (!this.listening || this.previewInFlight || this.pendingPieces) return;
    const { frames, overlap, silentFrames } = this.detector;
    const length = this.detector.currentLength();
    if (length < previewMinimum) return;
    if (this.preview?.first === frames[0]) {
      const step = silentFrames >= preRoll ? 1 : previewStep;
      if (length - this.preview.length < step) return;
    }
    const job = this.recognize(frames.slice(0, length));
    const preview = { first: frames[0], last: frames[length - 1], length, job };
    this.preview = preview;
    this.previewInFlight = job;
    void job.then(({ text }) => {
      this.previewInFlight = undefined;
      if (text && this.preview === preview) {
        this.onPreview(joinTranscript(this.completedText, text, overlap));
      }
    });
  }

  transcribePiece(frames, overlap) {
    const preview = this.preview;
    this.preview = undefined;
    const version = this.turnVersion;
    // The last preview can already cover the entire piece, including its trimmed tail.
    const sameAudio = preview?.length === frames.length && preview.first === frames[0]
      && preview.last === frames.at(-1);
    const job = sameAudio
      ? preview.job.then(result => result.error ? this.recognize(frames) : result)
      : Promise.all([this.pending, this.previewInFlight]).then(() => this.recognize(frames));
    this.pendingPieces++;
    const piece = job.then(result => {
      this.pendingPieces--;
      if (result.text && version === this.turnVersion) {
        this.completedText = joinTranscript(this.completedText, result.text, overlap);
        this.onPreview(this.completedText);
      }
      return { ...result, overlap };
    });
    this.pieces.push(piece);
    this.pending = piece;
  }

  async takeTranscript() {
    this.detector.finish();
    const pieces = this.pieces.splice(0);
    let text = "";
    let error;
    for (const piece of await Promise.all(pieces)) {
      if (piece.error) error = piece.error;
      else text = joinTranscript(text, piece.text, piece.overlap);
    }
    return { text, error };
  }

  discardTurn() {
    this.setListening(false);
    this.pieces.length = 0;
  }

  close() {
    this.setListening(false);
    this.stream.getTracks().forEach(track => track.stop());
    this.source.disconnect();
    this.node.disconnect();
    this.node.port.close();
    void this.context.close().catch(() => {});
  }
}
