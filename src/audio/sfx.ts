/** Sound effects synthesized with WebAudio (no audio files). */

export type SfxKind = 'shot' | 'plant' | 'claim' | 'kill' | 'break';

export interface Sfx {
  /**
   * Unlocks the audio. Phone browsers only allow playback after a touch from the person,
   * so this is called on the first gesture (touch or key).
   */
  unlock(): void;
  play(kind: SfxKind): void;
  /** Turns sound on/off. Returns `true` if it is now muted. */
  toggleMute(): boolean;
}

export function createSfx(): Sfx {
  let ac: AudioContext | null = null;
  let muted = false;

  function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.035, slide = 0): void {
    if (muted) return;
    try {
      ac = ac ?? new AudioContext();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const t = ac.currentTime;
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t);
      osc.stop(t + dur);
    } catch {
      // No audio available (or blocked by the browser): the game carries on in silence.
    }
  }

  return {
    unlock() {
      try {
        ac = ac ?? new AudioContext();
        if (ac.state === 'suspended') void ac.resume();
      } catch {
        // No audio available: the game carries on in silence.
      }
    },
    play(kind) {
      switch (kind) {
        case 'shot':
          beep(520, 0.09, 'square', 0.03, -300);
          break;
        case 'plant':
          beep(660, 0.12, 'triangle', 0.06, 200);
          break;
        case 'claim':
          beep(520, 0.12, 'triangle', 0.07);
          setTimeout(() => beep(780, 0.2, 'triangle', 0.07), 110);
          break;
        case 'kill':
          beep(220, 0.25, 'sawtooth', 0.05, -150);
          break;
        case 'break':
          beep(300, 0.18, 'sawtooth', 0.05, -200);
          break;
      }
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
  };
}
