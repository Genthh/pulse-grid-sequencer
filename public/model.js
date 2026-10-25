"use strict";

const PulseGrid = (() => {
  const tracks = ["Kick", "Snare", "Closed hat", "Rim"];
  const steps = 16;
  const presets = {
    pocket: [
      [0, 7, 10],
      [4, 12],
      [0, 2, 4, 6, 8, 10, 12, 14],
      [3, 15],
    ],
    drive: [
      [0, 4, 8, 12],
      [4, 12],
      [2, 6, 10, 14],
      [7, 11, 15],
    ],
    breaks: [
      [0, 3, 8, 10],
      [4, 9, 12, 14],
      [0, 2, 5, 6, 8, 10, 13, 15],
      [3, 7, 11],
    ],
    empty: [[], [], [], []],
  };

  function makePattern(name) {
    if (!Object.hasOwn(presets, name)) throw new RangeError("Unknown pattern.");
    return presets[name].map((hits) =>
      Array.from({ length: steps }, (_, step) => hits.includes(step)),
    );
  }

  function toggle(pattern, track, step) {
    if (
      !Number.isInteger(track) ||
      track < 0 ||
      track >= tracks.length ||
      !Number.isInteger(step) ||
      step < 0 ||
      step >= steps
    ) {
      throw new RangeError("Choose a pad within the grid.");
    }
    return pattern.map((pads, index) =>
      index === track
        ? pads.map((on, index) => (index === step ? !on : on))
        : pads,
    );
  }

  function stepDuration(bpm) {
    if (!Number.isFinite(bpm) || bpm < 50 || bpm > 190)
      throw new RangeError("Use 50 to 190 BPM.");
    return 60 / bpm / 4;
  }

  function encodeLoop(pattern, bpm) {
    if (!Number.isInteger(bpm))
      throw new RangeError("Choose a whole-number tempo.");
    stepDuration(bpm);
    if (!Array.isArray(pattern) || pattern.length !== tracks.length)
      throw new RangeError("Expected four tracks.");
    const words = Array.from(pattern, (row) => {
      if (
        !Array.isArray(row) ||
        row.length !== steps ||
        !Array.from(row).every((on) => typeof on === "boolean")
      )
        throw new RangeError("Expected sixteen pads per track.");
      return row
        .reduce((mask, on) => mask * 2 + Number(on), 0)
        .toString(16)
        .padStart(4, "0");
    });
    return "v1." + bpm + "." + words.join("");
  }

  function decodeLoop(code) {
    if (typeof code !== "string" || code.length > 24) return null;
    const match = /^v1\.([1-9]\d{1,2})\.([a-f0-9]{16})$/i.exec(code);
    if (!match) return null;
    const bpm = Number(match[1]);
    if (bpm < 50 || bpm > 190) return null;
    const pattern = match[2].match(/.{4}/g).map((word) => {
      const mask = parseInt(word, 16);
      return Array.from({ length: steps }, (_, i) =>
        Boolean(mask & (1 << (steps - i - 1))),
      );
    });
    return { bpm, pattern };
  }

  function presetFor(pattern) {
    const signature = encodeLoop(pattern, 120);
    return (
      ["pocket", "drive", "breaks"].find(
        (name) => encodeLoop(makePattern(name), 120) === signature,
      ) || "custom"
    );
  }

  return {
    tracks,
    steps,
    makePattern,
    toggle,
    stepDuration,
    encodeLoop,
    decodeLoop,
    presetFor,
  };
})();
if (typeof module !== "undefined") module.exports = PulseGrid;
else globalThis.PulseGridModel = PulseGrid;
