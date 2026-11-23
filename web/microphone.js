class MicrophoneFrames extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = Math.round(sampleRate / 20);
    this.frame = new Float32Array(this.size);
    this.offset = 0;
  }

  process(inputs) {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (let index = 0; index < channel.length;) {
      const count = Math.min(this.size - this.offset, channel.length - index);
      this.frame.set(channel.subarray(index, index + count), this.offset);
      this.offset += count;
      index += count;
      if (this.offset === this.size) {
        this.port.postMessage(this.frame, [this.frame.buffer]);
        this.frame = new Float32Array(this.size);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("microphone-frames", MicrophoneFrames);
