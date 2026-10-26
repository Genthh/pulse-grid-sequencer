"use strict";

(() => {
  const { tracks, steps, makePattern, toggle, stepDuration } =
    globalThis.PulseGridModel;
  const id = (name) => document.getElementById(name);
  const grid = id("grid");
  const button = id("play");
  const tempo = id("tempo");
  const preset = id("preset");
  const rows = [];
  let pattern = makePattern("pocket");
  let audio;
  let noise;
  let bus;
  let timer;
  let frame;
  let step = 0;
  let nextTime = 0;
  let playing = false;
  let session = 0;
  let pending = [];
  let persistence;

  function renderPattern() {
    for (const [track, row] of rows.entries()) {
      row.forEach((pad, index) =>
        pad.setAttribute("aria-pressed", String(pattern[track][index])),
      );
    }
  }

  tracks.forEach((name, index) => {
    const row = document.createElement("section");
    row.className = "track";
    row.setAttribute("aria-label", name);
    const heading = document.createElement("h3");
    heading.textContent = name;
    const pads = document.createElement("div");
    pads.className = "pads";
    const buttons = [];
    for (let col = 0; col < steps; col++) {
      const pad = document.createElement("button");
      pad.type = "button";
      pad.textContent = String(col + 1);
      pad.dataset.track = index;
      pad.dataset.step = col;
      pad.setAttribute("aria-label", name + ", step " + (col + 1));
      pad.tabIndex = col === 0 ? 0 : -1;
      pads.append(pad);
      buttons.push(pad);
    }
    row.append(heading, pads);
    grid.append(row);
    rows.push(buttons);
  });

  grid.addEventListener("focusin", (event) => {
    const pad = event.target.closest("button");
    if (pad)
      rows[Number(pad.dataset.track)].forEach((entry) => {
        entry.tabIndex = entry === pad ? 0 : -1;
      });
  });

  grid.addEventListener("keydown", (event) => {
    const pad = event.target.closest("button");
    if (!pad) return;
    let col = Number(pad.dataset.step);
    let row = Number(pad.dataset.track);
    switch (event.key) {
      case "ArrowLeft":
        col = (col + steps - 1) % steps;
        break;
      case "ArrowRight":
        col = (col + 1) % steps;
        break;
      case "ArrowUp":
        row = (row + tracks.length - 1) % tracks.length;
        break;
      case "ArrowDown":
        row = (row + 1) % tracks.length;
        break;
      case "Home":
        col = 0;
        break;
      case "End":
        col = steps - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    rows[row][col].focus();
  });
  grid.addEventListener("click", (event) => {
    const pad = event.target.closest("button");
    if (!pad) return;
    pattern = toggle(
      pattern,
      Number(pad.dataset.track),
      Number(pad.dataset.step),
    );
    preset.value = "custom";
    renderPattern();
    persistence.changed();
  });

  function playVoice(track, time) {
    const envelope = audio.createGain();
    const noisy = track === 1 || track === 2;
    const durations = [0.19, 0.14, 0.052, 0.065];
    const levels = [0.58, 0.28, 0.15, 0.2];
    const end = time + durations[track];
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(levels[track], time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.001, end);
    envelope.connect(bus);
    const source = noisy
      ? audio.createBufferSource()
      : audio.createOscillator();
    let filter;
    if (noisy) {
      source.buffer = noise;
      filter = audio.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = track === 1 ? 1200 : 5700;
      source.connect(filter);
      filter.connect(envelope);
    } else {
      source.type = track === 0 ? "sine" : "triangle";
      source.frequency.setValueAtTime(track === 0 ? 145 : 680, time);
      source.frequency.exponentialRampToValueAtTime(
        track === 0 ? 43 : 390,
        end,
      );
      source.connect(envelope);
    }
    source.onended = () => {
      source.disconnect();
      filter?.disconnect();
      envelope.disconnect();
    };
    source.start(time);
    source.stop(end);
  }

  function schedule() {
    const now = audio.currentTime;
    if (nextTime < now) nextTime = now;
    while (nextTime < now + 0.09) {
      pattern.forEach((pads, track) => {
        if (pads[step]) playVoice(track, nextTime);
      });
      pending.push({ step, time: nextTime });
      step = (step + 1) % steps;
      nextTime += stepDuration(Number(tempo.value));
    }
  }

  function drawPlayhead() {
    if (!playing) return;
    let current;
    while (pending.length && pending[0].time <= audio.currentTime)
      current = pending.shift();
    if (current)
      rows.forEach((pads) =>
        pads.forEach((pad, index) => {
          pad.classList.toggle("current", current.step === index);
        }),
      );
    frame = requestAnimationFrame(drawPlayhead);
  }

  function stop(message = "Stopped") {
    session++;
    playing = false;
    clearInterval(timer);
    cancelAnimationFrame(frame);
    if (bus) bus.disconnect();
    bus = null;
    if (audio?.state === "running") audio.suspend().catch(() => {});
    pending = [];
    id("play-text").textContent = "Play";
    button.classList.remove("playing");
    rows.forEach((pads) =>
      pads.forEach((pad) => pad.classList.remove("current")),
    );
    id("status").textContent = message;
  }

  async function start() {
    const token = ++session;
    playing = true;
    button.classList.add("playing");
    id("play-text").textContent = "Stop";
    try {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) throw new Error("Unavailable");
      if (!audio || audio.state === "closed") {
        audio = new AudioEngine();
        audio.addEventListener("statechange", () => {
          if (playing && bus && audio.state !== "running")
            stop("Audio paused. Press Play to resume.");
        });
        noise = audio.createBuffer(
          1,
          Math.ceil(audio.sampleRate * 0.2),
          audio.sampleRate,
        );
        const samples = noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
      }
      await audio.resume();
      if (token !== session) return;
      bus = audio.createGain();
      bus.gain.value = 0.68;
      bus.connect(audio.destination);
      step = 0;
      nextTime = audio.currentTime + 0.025;
      id("status").textContent = "Playing";
      schedule();
      timer = setInterval(schedule, 25);
      drawPlayhead();
    } catch {
      if (token === session) stop("Audio is unavailable in this browser.");
    }
  }

  button.addEventListener("click", () => (playing ? stop() : start()));
  tempo.addEventListener("input", () => {
    id("tempo-value").textContent = tempo.value + " BPM";
    persistence.changed();
  });
  preset.addEventListener("change", () => {
    pattern = makePattern(preset.value);
    renderPattern();
    persistence.changed();
  });
  id("clear").addEventListener("click", () => {
    pattern = makePattern("empty");
    preset.value = "custom";
    renderPattern();
    persistence.changed();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && playing) stop();
  });
  window.addEventListener("pagehide", () => {
    if (playing) stop();
  });
  persistence = globalThis.setupLoopStorage({
    current: () => ({ pattern, bpm: Number(tempo.value) }),
    apply: (loop) => {
      if (playing) stop();
      pattern = loop.pattern;
      tempo.value = loop.bpm;
      id("tempo-value").textContent = loop.bpm + " BPM";
      preset.value = globalThis.PulseGridModel.presetFor(pattern);
      renderPattern();
    },
  });
  renderPattern();
})();
