"use strict";

globalThis.setupLoopStorage = function ({ current, apply }) {
  const { encodeLoop, decodeLoop } = globalThis.PulseGridModel;
  const id = (name) => document.getElementById(name);
  const notice = id("loop-notice");
  const panel = id("link-panel");
  const field = id("share-url");
  const key = "pulsegrid.loop.v1";
  const prefix = "#loop=";

  function encodeCurrent() {
    const { pattern, bpm } = current();
    return encodeLoop(pattern, bpm);
  }

  function makeURL() {
    const url = new URL(location.href);
    url.hash = prefix + encodeCurrent();
    return url.href;
  }

  function restore() {
    const hasLink = location.hash.startsWith(prefix);
    if (hasLink) {
      const shared = decodeLoop(location.hash.slice(prefix.length));
      if (shared) {
        apply(shared);
        notice.textContent =
          "Shared loop loaded. Edits will become your local draft.";
        return;
      }
    }
    let message = "";
    try {
      const raw = localStorage.getItem(key);
      const draft = decodeLoop(raw);
      if (draft) {
        apply(draft);
        message = "Restored your local draft.";
      } else if (raw !== null) {
        message = "Your saved draft could not be read.";
      }
    } catch {
      message =
        "Browser storage is unavailable. Keep a loop link to save edits.";
    }
    if (hasLink) message = "This loop link is invalid. " + message;
    notice.textContent = message.trim() || "Edits are saved in this browser.";
  }

  function changed() {
    const code = encodeCurrent();
    if (location.hash.startsWith(prefix)) {
      const url = new URL(location.href);
      url.hash = "";
      try {
        history.replaceState(history.state, "", url);
      } catch {
        location.replace("#loop=" + code);
      }
    }
    if (!panel.hidden) field.value = makeURL();
    try {
      localStorage.setItem(key, code);
      notice.textContent = "Draft saved in this browser.";
    } catch {
      notice.textContent =
        "Draft could not be saved. Use Share loop to keep a copy.";
    }
  }

  id("share-loop").addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    id("share-loop").setAttribute("aria-expanded", String(opening));
    if (opening) {
      field.value = makeURL();
      field.focus();
      field.select();
    }
  });

  id("copy-loop").addEventListener("click", async () => {
    field.value = makeURL();
    try {
      await navigator.clipboard.writeText(field.value);
      notice.textContent = "Loop link copied.";
    } catch {
      field.focus();
      field.select();
      notice.textContent = "Copy the selected loop link.";
    }
  });

  window.addEventListener("hashchange", () => {
    restore();
    if (!panel.hidden) field.value = makeURL();
  });
  restore();
  return { changed };
};
