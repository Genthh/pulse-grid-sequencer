const assert = require("node:assert/strict");
const test = require("node:test");
const { makePattern, toggle, stepDuration } = require("../public/model.js");

test("all presets are four independent sixteen-step tracks", () => {
  for (const name of ["pocket", "drive", "breaks", "empty"]) {
    const pattern = makePattern(name);
    assert.equal(pattern.length, 4);
    assert.ok(pattern.every((track) => track.length === 16));
    assert.ok(pattern.flat().every((value) => typeof value === "boolean"));
  }
  const pattern = makePattern("drive");
  pattern[0][0] = false;
  assert.equal(makePattern("drive")[0][0], true);
  assert.equal(makePattern("empty").flat().some(Boolean), false);
  assert.throws(() => makePattern("unknown"), RangeError);
});

test("edits one pad without modifying the original pattern", () => {
  const pattern = makePattern("empty");
  const edited = toggle(pattern, 3, 15);
  assert.equal(pattern[3][15], false);
  assert.deepEqual(edited.flat().filter(Boolean), [true]);
  assert.deepEqual(toggle(edited, 3, 15), pattern);
  for (const [row, column] of [
    [4, 0],
    [-1, 0],
    [0, 16],
    [1, 1.5],
  ]) {
    assert.throws(() => toggle(pattern, row, column), RangeError);
  }
});

test("a bar is four beats at the selected tempo", () => {
  assert.equal(stepDuration(120) * 16, 2);
  assert.equal(stepDuration(60) * 16, 4);
  for (const invalid of [NaN, 0, 49, 191]) {
    assert.throws(() => stepDuration(invalid), RangeError);
  }
});

const { encodeLoop, decodeLoop, presetFor } = require("../public/model.js");

test("portable codes round-trip all four tracks and the tempo", () => {
  for (const bpm of [50, 112, 190]) {
    let pattern = makePattern("empty");
    for (let step = 0; step < 16; step++)
      pattern = toggle(pattern, step % 4, step);
    const encoded = encodeLoop(pattern, bpm);
    assert.deepEqual(decodeLoop(encoded), { pattern, bpm });
    assert.equal(presetFor(pattern), "custom");
  }
  assert.equal(encodeLoop(makePattern("empty"), 50), "v1.50.0000000000000000");
  assert.equal(presetFor(makePattern("drive")), "drive");
});

test("share and draft parsing reject malformed payloads and out-of-range tempos", () => {
  for (const bad of [
    null,
    "v1.191.0000000000000000",
    "v1.049.0000000000000000",
    "v2.100.0000000000000000",
    "v1.120.0000",
    "v1.120.123456789ABCDEFG",
    "v1.120.0000000000000000extra",
  ]) {
    assert.equal(decodeLoop(bad), null);
  }
  assert.throws(() => encodeLoop(makePattern("pocket"), 90.5));
  assert.throws(() => encodeLoop([[false]], 90));
  const invalid = makePattern("pocket");
  invalid[1][3] = "on";
  assert.throws(() => encodeLoop(invalid, 100));
});

const { makeKit, renderBar, exportWav } = require("../public/audio.js");

test("WAV writes a consistent mono PCM header and the exact one-bar frame count", () => {
  for (const bpm of [50, 113, 190]) {
    const data = Buffer.from(exportWav(makePattern("pocket"), bpm));
    const frames = Math.round((44100 * 240) / bpm);
    assert.equal(data.toString("ascii", 0, 4), "RIFF");
    assert.equal(data.readUInt32LE(4), data.length - 8);
    assert.equal(data.toString("ascii", 8, 16), "WAVEfmt ");
    assert.equal(data.readUInt16LE(20), 1);
    assert.equal(data.readUInt16LE(22), 1);
    assert.equal(data.readUInt32LE(24), 44100);
    assert.equal(data.readUInt32LE(28), 88200);
    assert.equal(data.readUInt16LE(32), 2);
    assert.equal(data.readUInt16LE(34), 16);
    assert.equal(data.toString("ascii", 36, 40), "data");
    assert.equal(data.readUInt32LE(40), frames * 2);
    assert.equal(data.length, 44 + frames * 2);
    assert.ok(data.subarray(44).some((byte) => byte !== 0));
  }
});

test("renders the actual four drum sounds at their programmed sample offsets", () => {
  const rate = 16000;
  const bpm = 110;
  const kit = makeKit(rate);
  for (let track = 0; track < 4; track++) {
    const pattern = toggle(makePattern("empty"), track, 4);
    const rendered = renderBar(pattern, bpm, rate);
    const start = Math.round((4 * rate * 60) / bpm / 4);
    assert.ok(rendered.subarray(0, start).every((sample) => sample === 0));
    assert.ok(
      kit[track].every((sample, index) => rendered[start + index] === sample),
    );
    assert.ok(kit[track].some((sample) => Math.abs(sample) > 0.001));
  }
  const silent = Buffer.from(exportWav(makePattern("empty"), 113));
  assert.ok(silent.subarray(44).every((byte) => byte === 0));
  assert.throws(() => renderBar([], 120, rate));
});

test("last-step tails wrap into the start of a looping WAV", () => {
  const lastKick = toggle(makePattern("empty"), 0, 15);
  const rendered = renderBar(lastKick, 190, 16000);
  assert.ok(
    rendered.subarray(0, 200).some((sample) => Math.abs(sample) > 0.0001),
  );
});
