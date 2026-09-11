class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private getCtx() {
    if (!this.enabled) return null;
    if (!this.ctx) { try { this.ctx = new AudioContext(); } catch { return null; } }
    return this.ctx;
  }
  setEnabled(enabled: boolean) { this.enabled = enabled; }
  playPlace() { this.tone(440, 0.1, 0.15); }
  playMove() { this.tone(330, 0.15, 0.12); }
  playMill() { [523,659,784].forEach((f,i)=>this.tone(f,0.2,0.15,i*0.1)); }
  playRemove() { const ctx=this.getCtx(); if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.type='sawtooth';o.frequency.value=220;g.gain.setValueAtTime(.1,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.01,ctx.currentTime+.2);o.start();o.stop(ctx.currentTime+.2); }
  playWin() { [523,659,784,1047].forEach((f,i)=>this.tone(f,.3,.2,i*.15)); }
  playLose() { [400,350,300,250].forEach((f,i)=>this.tone(f,.3,.15,i*.2)); }
  private tone(freq:number,duration:number,gainValue:number,delay=0) {
    const ctx=this.getCtx(); if(!ctx)return; const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.value=freq;g.gain.setValueAtTime(gainValue,ctx.currentTime+delay);g.gain.exponentialRampToValueAtTime(.01,ctx.currentTime+delay+duration);o.start(ctx.currentTime+delay);o.stop(ctx.currentTime+delay+duration);
  }
}
export const soundManager = new SoundManager();