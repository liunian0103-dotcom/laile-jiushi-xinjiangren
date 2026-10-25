/* Page layout works independently of the host browser's Fullscreen API. */
(() => {
  "use strict";
  const root = document.getElementById("viewport-root");
  const toolbar = document.getElementById("viewport-toolbar");
  const safeProbe = document.getElementById("viewport-safe-area");
  let wide = false;
  let rotation = 0;
  let frame = 0;
  let lastGeometry = "";

  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  function sync() {
    frame = 0;
    const viewport = window.visualViewport;
    const width = viewport?.width || innerWidth;
    const height = viewport?.height || innerHeight;
    const safe = getComputedStyle(safeProbe);
    const inset = side => parseFloat(safe.getPropertyValue(`padding-${side}`)) || 0;
    const left = inset("left"), right = inset("right");
    const top = inset("top"), bottom = inset("bottom");
    const usableWidth = Math.max(1, width - left - right);
    const usableHeight = Math.max(1, height - top - bottom);
    rotation = wide && usableHeight > usableWidth ? 90 : 0;
    root.style.width = `${rotation ? usableHeight : usableWidth}px`;
    root.style.height = `${rotation ? usableWidth : usableHeight}px`;
    root.style.left = `${(viewport?.offsetLeft || 0) + left + usableWidth / 2}px`;
    root.style.top = `${(viewport?.offsetTop || 0) + top + usableHeight / 2}px`;
    root.style.setProperty("--view-rotation", `${rotation}deg`);
    root.dataset.rotation = String(rotation);
    document.body.dataset.webLandscape = String(wide);
    document.body.dataset.viewport = rotation || usableWidth >= usableHeight ? "wide" : "tall";
    toolbar.hidden = !wide;
    const mobile = matchMedia("(pointer:coarse)").matches;
    document.querySelectorAll("[data-fullscreen]").forEach(button => {
      button.textContent = wide ? "退出横屏" : mobile ? "横屏游玩 ↗" : "全屏游玩 ↗";
      button.setAttribute("aria-pressed", String(wide));
    });
    document.getElementById("viewportModeLabel").textContent = fullscreenElement() ? "横屏游玩" : "网页横屏模式";
    const geometry = `${wide}:${rotation}:${usableWidth.toFixed(1)}:${usableHeight.toFixed(1)}`;
    if (geometry !== lastGeometry) {
      lastGeometry = geometry;
      window.dispatchEvent(new Event("xinjiangviewportchange"));
    }
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(sync);
  }

  function leaveNative() {
    try {
      if (fullscreenElement()) {
        const result = document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen?.();
        Promise.resolve(result).catch(() => {}).finally(schedule);
      }
    } catch (_) {}
    try { screen.orientation?.unlock?.(); } catch (_) {}
  }

  function exit() {
    wide = false;
    sync();
    leaveNative();
  }

  function enter() {
    wide = true;
    sync(); // A missing, rejected, or hanging native request cannot block page layout.
    try {
      const element = document.documentElement;
      const request = element.requestFullscreen || element.webkitRequestFullscreen;
      if (!request || document.fullscreenEnabled === false || document.webkitFullscreenEnabled === false) return;
      const result = request.call(element);
      Promise.resolve(result).then(() => {
        if (!wide) { leaveNative(); return; }
        if (!fullscreenElement()) return;
        const lock = screen.orientation?.lock?.("landscape");
        Promise.resolve(lock).then(() => {
          if (!wide || !fullscreenElement()) screen.orientation?.unlock?.();
        }).catch(() => {});
      }).catch(() => {}).finally(schedule);
    } catch (_) { schedule(); }
  }

  function point(canvas, event, width, height) {
    const rect = canvas.getBoundingClientRect();
    if (rotation === 90) return {
      x: (event.clientY - rect.top) * width / rect.height,
      y: (rect.right - event.clientX) * height / rect.width,
    };
    return { x: (event.clientX - rect.left) * width / rect.width,
      y: (event.clientY - rect.top) * height / rect.height };
  }

  function bindModeButton(button, action) {
    let press = null;
    let ignoreClickUntil = 0;
    button.addEventListener("pointerdown", event => {
      if (event.pointerType !== "mouse" && event.isPrimary) {
        press = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      }
    });
    button.addEventListener("pointermove", event => {
      if (press?.id === event.pointerId && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) press.moved = true;
    });
    button.addEventListener("pointercancel", () => { press = null; });
    button.addEventListener("pointerup", event => {
      if (!press || press.id !== event.pointerId) return;
      const start = press;
      press = null;
      const hit = document.elementFromPoint(event.clientX, event.clientY);
      if (start.moved || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 12 || !hit || !button.contains(hit)) return;
      // Some mobile hosts suppress the first compatibility click after a drag.
      // Handle the touch release directly, then ignore its delayed click.
      ignoreClickUntil = performance.now() + 700;
      event.preventDefault();
      action();
    });
    button.addEventListener("click", event => {
      if (performance.now() < ignoreClickUntil) { event.preventDefault(); return; }
      action();
    });
  }
  document.querySelectorAll("[data-fullscreen]").forEach(button => bindModeButton(button, () => wide ? exit() : enter()));
  bindModeButton(document.getElementById("exitViewportMode"), exit);
  for (const name of ["resize", "orientationchange", "pageshow"]) window.addEventListener(name, schedule);
  window.visualViewport?.addEventListener("resize", schedule);
  window.visualViewport?.addEventListener("scroll", schedule);
  for (const name of ["fullscreenchange", "webkitfullscreenchange"]) document.addEventListener(name, () => {
    // Native changes can arrive after a later button press. Keep the user's
    // requested page mode authoritative, including when native fullscreen ends.
    if (fullscreenElement() && !wide) leaveNative();
    schedule();
  });
  document.addEventListener("keydown", event => { if (event.key === "Escape" && wide) exit(); });
  window.XinjiangViewport = Object.freeze({ enter, exit, point, sync: schedule });
  sync();
})();
