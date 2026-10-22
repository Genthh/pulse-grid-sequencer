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
