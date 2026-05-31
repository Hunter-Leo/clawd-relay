const COOLDOWN_MS = 10_000;

type SoundEvent = "task_complete" | "permission_request";

class SoundManager {
  private enabled = true;
  private volume = 0.5;
  private lastPlayed: Record<string, number> = {};
  private audioCtx: AudioContext | null = null;

  private getCtx(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  play(event: SoundEvent) {
    if (!this.enabled) return;

    const now = Date.now();
    const last = this.lastPlayed[event] ?? 0;
    if (now - last < COOLDOWN_MS) return;
    this.lastPlayed[event] = now;

    try {
      const ctx = this.getCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      gain.gain.value = this.volume * 0.15;

      if (event === "task_complete") {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else if (event === "permission_request") {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Web Audio API not available
    }
  }
}

let instance: SoundManager | null = null;
export function getSoundManager(): SoundManager {
  if (!instance) instance = new SoundManager();
  return instance;
}
