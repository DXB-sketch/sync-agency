import { useRef, useEffect } from "react";

export default function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + "px";
        dotRef.current.style.top = e.clientY + "px";
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isHover = el && (el.tagName === "A" || el.tagName === "BUTTON" || el.closest("a") || el.closest("button") || el.style.cursor === "pointer" || getComputedStyle(el).cursor === "pointer");
      hovered.current = isHover;
      if (ringRef.current) ringRef.current.classList.toggle("hovered", !!isHover);
    };
    let raf;
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12;
      ring.current.y += (pos.current.y - ring.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + "px";
        ringRef.current.style.top = ring.current.y + "px";
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    document.addEventListener("mousemove", onMove);
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor cursor-dot" style={{ position: "fixed", pointerEvents: "none", zIndex: 9999 }} />
      <div ref={ringRef} className="cursor cursor-ring" style={{ position: "fixed", pointerEvents: "none", zIndex: 9998 }} />
    </>
  );
}
