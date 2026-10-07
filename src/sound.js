// Tiny square-wave bleeps in the spirit of a 90s handheld.
let ctx;

const TUNES = {
  press: [[880, 0.05]],
  on: [[523, 0.08], [784, 0.08], [1047, 0.12]],
  off: [[784, 0.08], [523, 0.12]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.25]],
  lose: [[392, 0.15], [330, 0.15], [262, 0.3]],
};

export function beep(name) {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    for (const [freq, dur] of TUNES[name] ?? TUNES.press) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch {
    // No audio available; stay silent.
  }
}
