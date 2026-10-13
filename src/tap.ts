// The audio worklet that records. It runs on the browser's audio thread and
// hands the raw samples to the page in batches, and whatever's left over when
// the page asks (so the last fraction of a second isn't lost). The worklet's
// globals aren't in the DOM types, so the little it uses is declared here.
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}
declare function registerProcessor(name: string, processor: new () => AudioWorkletProcessor): void;

const BATCH = 2048;

registerProcessor(
  "tap",
  class extends AudioWorkletProcessor {
    buf = new Float32Array(BATCH);
    n = 0;

    constructor() {
      super();
      this.port.onmessage = () => {
        this.port.postMessage({ last: this.buf.slice(0, this.n) });
        this.n = 0;
      };
    }

    process([input]: Float32Array[][]): boolean {
      const ch = input[0];
      if (!ch) return true;
      for (const s of ch) {
        this.buf[this.n++] = s;
        if (this.n === BATCH) {
          this.port.postMessage({ samples: this.buf });
          this.buf = new Float32Array(BATCH);
          this.n = 0;
        }
      }
      return true;
    }
  },
);
