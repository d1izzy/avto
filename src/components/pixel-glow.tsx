import { useEffect, useRef } from "react";
import { useTheme } from "@astryxdesign/core/theme";

/** A fixed grid of pixels lit by slowly travelling pools of light. */
export function PixelGlow({ phase = 0 }: { phase?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { tokens } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const mask = document.createElement("canvas");
    const maskContext = mask.getContext("2d");
    if (!maskContext) return;

    const accent = tokens["--color-accent"]!;
    const highlight = tokens["--color-text-primary"]!;
    const style = getComputedStyle(canvas);
    const step = Number.parseFloat(style.getPropertyValue("--studio-pixel-step"));
    const dot = Number.parseFloat(style.getPropertyValue("--studio-pixel-dot"));
    const cycle = Number.parseFloat(style.getPropertyValue("--studio-glow-cycle"));
    const strength = Number.parseFloat(style.getPropertyValue("--studio-glow-strength"));
    if (![step, dot, cycle, strength].every((value) => Number.isFinite(value) && value > 0)) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0, height = 0, scale = 1;
    let frame = 0, lastTime = 0, elapsed = 0;
    let visible = false;

    function glow(x: number, y: number, radiusX: number, radiusY: number, opacity: number) {
      context!.save();
      context!.translate(x * width, y * height);
      context!.scale(radiusX * width, radiusY * height);
      const gradient = context!.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, highlight);
      gradient.addColorStop(0.2, accent);
      gradient.addColorStop(1, "transparent");
      context!.globalAlpha = opacity;
      context!.fillStyle = gradient;
      context!.fillRect(-1, -1, 2, 2);
      context!.restore();
    }

    function paint() {
      if (!width || !height) return;
      const t = elapsed / cycle * Math.PI * 2 + phase;
      context!.setTransform(scale, 0, 0, scale, 0, 0);
      context!.clearRect(0, 0, width, height);
      context!.fillStyle = accent;
      context!.globalAlpha = 0.025;
      context!.fillRect(0, 0, width, height);
      context!.globalAlpha = 1;
      // The lights move independently; the grid never shifts beneath the text.
      glow(0.66 + Math.sin(t) * 0.2, 0.48 + Math.cos(t * 0.8) * 0.32, 0.31, 0.4, strength);
      glow(0.32 + Math.cos(t * 0.7 + 1.4) * 0.22, 0.65 + Math.sin(t * 0.9) * 0.28, 0.28, 0.36, strength * 0.7);
      context!.globalCompositeOperation = "destination-in";
      context!.drawImage(mask, 0, 0, width, height);
      context!.globalCompositeOperation = "source-over";
    }

    function tick(now: number) {
      if (now - lastTime >= 1000 / 30) {
        // Pausing a hidden card must not jump its lights when it returns.
        elapsed += lastTime ? Math.min(now - lastTime, 100) : 0;
        lastTime = now;
        paint();
      }
      frame = requestAnimationFrame(tick);
    }

    function updatePlayback() {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (reducedMotion.matches) elapsed = 0;
      paint();
      if (visible && !document.hidden && !reducedMotion.matches) frame = requestAnimationFrame(tick);
    }

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      width = entry.contentRect.width;
      height = entry.contentRect.height;
      scale = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = mask.width = Math.round(width * scale);
      canvas.height = mask.height = Math.round(height * scale);
      maskContext.setTransform(scale, 0, 0, scale, 0, 0);
      maskContext.clearRect(0, 0, width, height);
      maskContext.fillStyle = accent;
      for (let y = 0; y < height; y += step) {
        for (let x = 0; x < width; x += step) maskContext.fillRect(x, y, dot, dot);
      }
      paint();
    });
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      updatePlayback();
    });
    resize.observe(canvas);
    intersection.observe(canvas);
    document.addEventListener("visibilitychange", updatePlayback);
    reducedMotion.addEventListener("change", updatePlayback);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", updatePlayback);
      reducedMotion.removeEventListener("change", updatePlayback);
    };
  }, [phase, tokens]);

  return <canvas ref={ref} aria-hidden="true" data-pixel-glow className="pointer-events-none absolute inset-0 block size-full" />;
}
