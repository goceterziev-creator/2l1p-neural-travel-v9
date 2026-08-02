/*
  GT63 Design System Motion Foundation v3
  Navigation Pulse API for OCR, AI processing, proposal generation and completion states.
  Public API: GT63Pulse.start(mode), GT63Pulse.finish(), GT63Pulse.stop().
*/

window.GT63Pulse = (() => {
  const activeModes = new Set(["ai", "ocr", "proposal"]);
  let finishTimer = 0;

  function clearFinish() {
    window.clearTimeout(finishTimer);
    document.body?.removeAttribute("data-gt63-pulse-finish");
  }

  function start(mode = "ai") {
    const nextMode = activeModes.has(mode) ? mode : "ai";
    clearFinish();
    document.body?.setAttribute("data-gt63-pulse", nextMode);
  }

  function stop() {
    clearFinish();
    document.body?.removeAttribute("data-gt63-pulse");
  }

  function finish() {
    clearFinish();
    document.body?.removeAttribute("data-gt63-pulse");
    document.body?.setAttribute("data-gt63-pulse-finish", "true");
    finishTimer = window.setTimeout(() => {
      document.body?.removeAttribute("data-gt63-pulse-finish");
    }, 640);
  }

  return { start, finish, stop };
})();
