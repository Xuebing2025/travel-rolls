(function () {
  const root = document.querySelector("#intro-motion-root");
  let cleanup = null;

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;
  }

  function complete(reason = "complete") {
    if (typeof cleanup === "function") cleanup();
    cleanup = null;
    root.replaceChildren();
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("intro-motion-active");
    document.dispatchEvent(new CustomEvent("travelrolls:intro-complete", { detail: { reason } }));
  }

  function mount(renderer, options = {}) {
    if (typeof renderer !== "function") throw new TypeError("intro_renderer_required");
    complete("replace");
    const reducedMotion = prefersReducedMotion();
    if (reducedMotion && options.respectReducedMotion !== false) {
      document.dispatchEvent(new CustomEvent("travelrolls:intro-skipped", {
        detail: { reason: "reduced-motion" },
      }));
      return false;
    }
    root.hidden = false;
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("intro-motion-active");
    cleanup = renderer(root, Object.freeze({ complete, reducedMotion })) || null;
    document.dispatchEvent(new CustomEvent("travelrolls:intro-mounted", {
      detail: { provider: root.dataset.motionProvider },
    }));
    return true;
  }

  window.TravelRollsIntro = Object.freeze({
    root,
    mount,
    complete,
    prefersReducedMotion,
  });
  document.dispatchEvent(new CustomEvent("travelrolls:intro-ready", {
    detail: { provider: root.dataset.motionProvider },
  }));
})();
