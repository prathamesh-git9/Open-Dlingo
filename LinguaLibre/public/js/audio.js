/* LinguaLibre — sound effects (Web Audio API, generated locally — no copyrighted audio files) */
const SFX = (() => {
  let ctx;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }
  function tone(freq, start, dur, type = "sine", gain = 0.18) {
    const c = ac();
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, c.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
    o.connect(g).connect(c.destination);
    o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
  }
  return {
    correct() { tone(659, 0, 0.14, "triangle"); tone(880, 0.12, 0.2, "triangle"); },
    wrong() { tone(233, 0, 0.25, "sawtooth", 0.12); tone(196, 0.18, 0.3, "sawtooth", 0.12); },
    complete() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.25, "triangle")); },
    tap() { tone(440, 0, 0.06, "square", 0.05); },
    speak(text, lang = "de-DE") {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang; u.rate = 0.95;
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
      } catch (e) { /* TTS unsupported — silently skip */ }
    }
  };
})();
