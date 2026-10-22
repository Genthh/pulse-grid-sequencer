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

  return { tracks, steps, makePattern, toggle, stepDuration };
})();
if (typeof module !== "undefined") module.exports = PulseGrid;
else globalThis.PulseGridModel = PulseGrid;
