export class PcmStreamingPlayer {
  private ctx: AudioContext | null = null;
  private nextStartTime = 0;
  private active: AudioBufferSourceNode[] = [];

  private ensureContext(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
    return this.ctx;
  }

  enqueue(pcm16Base64: string, sampleRate: number): void {
    const ctx = this.ensureContext();
    const binary = atob(pcm16Base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const samples = new Int16Array(bytes.buffer);
    if (samples.length === 0) return;

    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const startAt = Math.max(ctx.currentTime, this.nextStartTime);
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.active.push(source);
    source.onended = () => {
      this.active = this.active.filter((s) => s !== source);
    };
  }

  stopImmediately(): void {
    for (const source of this.active) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.active = [];
    this.nextStartTime = this.ctx?.currentTime ?? 0;
  }

  dispose(): void {
    this.stopImmediately();
    void this.ctx?.close();
    this.ctx = null;
  }
}
