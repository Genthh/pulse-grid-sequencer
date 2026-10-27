"use strict";

const PulseAudio = (() => {
  const masterGain = 0.68;
  const voices = [
    { duration: 0.19, level: 0.58, start: 145, end: 43 },
    { duration: 0.14, level: 0.28, cutoff: 1200 },
    { duration: 0.052, level: 0.15, cutoff: 5700 },
    { duration: 0.065, level: 0.2, start: 680, end: 390 },
  ];

  function makeKit(sampleRate) {
    return voices.map((voice, track) => {
      const samples = new Float32Array(Math.ceil(sampleRate * voice.duration));
      let phase = 0;
      let seed = track + 32;
      let lowPass = 0;
      const alpha = voice.cutoff
        ? 1 - Math.exp((-2 * Math.PI * voice.cutoff) / sampleRate)
        : 0;
      const attack = 0.003;
      for (let i = 0; i < samples.length; i++) {
        const time = i / sampleRate;
        const decayPosition = (time - attack) / (voice.duration - attack);
        const gain =
          time < attack
            ? (voice.level * time) / attack
            : voice.level * Math.pow(0.001 / voice.level, decayPosition);
        let value;
        if (voice.cutoff) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          const white = seed / 2147483648 - 1;
          lowPass += alpha * (white - lowPass);
          value = white - lowPass;
        } else {
          const frequency =
            voice.start *
            Math.pow(voice.end / voice.start, time / voice.duration);
          const sine = Math.sin(phase);
          value = track === 3 ? (2 / Math.PI) * Math.asin(sine) : sine;
          phase += (frequency * 2 * Math.PI) / sampleRate;
        }
        const fadeOut = Math.min(
          1,
          (samples.length - 1 - i) / (0.001 * sampleRate),
        );
        samples[i] = gain * masterGain * value * fadeOut;
      }
      return samples;
    });
  }

  function renderBar(pattern, bpm, sampleRate = 44100) {
    if (!Number.isInteger(bpm) || bpm < 50 || bpm > 190)
      throw new RangeError("Invalid tempo.");
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 192000
    )
      throw new RangeError("Invalid audio sample rate.");
    if (
      !Array.isArray(pattern) ||
      pattern.length !== 4 ||
      !Array.from(pattern).every(
        (row) =>
          Array.isArray(row) &&
          row.length === 16 &&
          Array.from(row).every((hit) => typeof hit === "boolean"),
      )
    )
      throw new RangeError("Invalid drum pattern.");
    const frameStep = (sampleRate * 60) / bpm / 4;
    const output = new Float32Array(Math.round(frameStep * 16));
    const kit = makeKit(sampleRate);
    pattern.forEach((row, track) => {
      row.forEach((on, step) => {
        if (!on) return;
        const start = Math.round(step * frameStep);
        const voice = kit[track];
        for (let i = 0; i < voice.length; i++) {
          output[(start + i) % output.length] += voice[i];
        }
      });
    });
    return output;
  }

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);
    function text(offset, value) {
      for (let i = 0; i < value.length; i++)
        view.setUint8(offset + i, value.charCodeAt(i));
    }
    text(0, "RIFF");
    view.setUint32(4, buffer.byteLength - 8, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    text(36, "data");
    view.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(
        44 + i * 2,
        Math.round(sample * (sample < 0 ? 32768 : 32767)),
        true,
      );
    }
    return buffer;
  }

  function exportWav(pattern, bpm) {
    const sampleRate = 44100;
    return encodeWav(renderBar(pattern, bpm, sampleRate), sampleRate);
  }
  return { makeKit, renderBar, exportWav };
})();

if (typeof module !== "undefined") module.exports = PulseAudio;
else globalThis.PulseAudioEngine = PulseAudio;
