class PCMCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    this._bufferSize = 4800;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const samples = input[0];
    for (let i = 0; i < samples.length; i++) {
      this._buffer.push(samples[i]);
    }

    while (this._buffer.length >= this._bufferSize) {
      const chunk = this._buffer.splice(0, this._bufferSize);
      const pcm16 = new Int16Array(chunk.length);
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      this.port.postMessage({ type: "audio", data: btoa(binary) });
    }

    return true;
  }
}

registerProcessor("pcm-capture-processor", PCMCaptureProcessor);
