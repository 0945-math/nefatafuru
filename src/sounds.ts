// Sound effects using Web Audio API
class SoundManager {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    if (!this.enabled) return;
    
    try {
      const ctx = this.getContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = type;
      
      gainNode.gain.setValueAtTime(volume, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    } catch (e) {
      // Silently fail if audio context is not available
    }
  }

  // Place piece sound
  playPlace() {
    this.playTone(440, 0.15, 'sine', 0.2);
    setTimeout(() => this.playTone(554, 0.1, 'sine', 0.15), 50);
  }

  // Move piece sound
  playMove() {
    this.playTone(330, 0.1, 'triangle', 0.2);
    setTimeout(() => this.playTone(440, 0.1, 'triangle', 0.15), 80);
  }

  // Remove piece sound
  playRemove() {
    this.playTone(220, 0.2, 'sawtooth', 0.15);
    setTimeout(() => this.playTone(165, 0.3, 'sawtooth', 0.1), 100);
  }

  // Mill formed sound
  playMill() {
    this.playTone(523, 0.15, 'sine', 0.25);
    setTimeout(() => this.playTone(659, 0.15, 'sine', 0.25), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.3), 200);
  }

  // Win sound
  playWin() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 0.3, 'sine', 0.2), i * 150);
    });
  }

  // Lose sound
  playLose() {
    const notes = [440, 370, 330, 262];
    notes.forEach((note, i) => {
      setTimeout(() => this.playTone(note, 0.4, 'sine', 0.15), i * 200);
    });
  }

  // Select piece sound
  playSelect() {
    this.playTone(600, 0.08, 'sine', 0.15);
  }

  // Invalid move sound
  playInvalid() {
    this.playTone(200, 0.15, 'square', 0.1);
  }
}

export const soundManager = new SoundManager();
