import { useEffect, useState } from "react";

export function useKeyboardViewport() {
  const [viewportSize, setViewportSize] = useState<{ height: number; top: number }>();
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setViewportSize(viewport && viewport.height < window.innerHeight * 0.8 ? { height: viewport.height * 0.9, top: viewport.offsetTop + viewport.height * 0.05 } : undefined);
    viewport?.addEventListener("resize", update); viewport?.addEventListener("scroll", update); update();
    return () => { viewport?.removeEventListener("resize", update); viewport?.removeEventListener("scroll", update); };
  }, []);
  return viewportSize;
}
