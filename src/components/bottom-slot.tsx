"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export function BottomSlot({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [fixed, setFixed] = useState(false);

  useEffect(() => {
    const slot = slotRef.current;
    const shell = slot?.closest<HTMLElement>(".task-shell");
    if (!slot || !shell) return;

    let animationFrame = 0;
    const measure = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const hasContent = slot.childElementCount > 0;
        const slotHeight = hasContent ? slot.getBoundingClientRect().height : 0;
        const primaryNav = document.querySelector<HTMLElement>(".primary-nav");
        const navHeight =
          primaryNav && getComputedStyle(primaryNav).position === "fixed"
            ? primaryNav.getBoundingClientRect().height
            : 0;
        const canStayFixed =
          window.innerWidth < 900 &&
          slotHeight > 0 &&
          slotHeight + navHeight <= window.innerHeight * 0.25;

        setFixed(canStayFixed);
        shell.style.setProperty(
          "--bottom-slot-height",
          canStayFixed ? `${Math.ceil(slotHeight)}px` : "0px",
        );
      });
    };

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(slot);
    const primaryNav = document.querySelector<HTMLElement>(".primary-nav");
    if (primaryNav) observer?.observe(primaryNav);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    measure();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      shell.style.removeProperty("--bottom-slot-height");
    };
  }, []);

  return (
    <div
      ref={slotRef}
      className="bottom-slot"
      data-bottom-slot="true"
      data-layout={fixed ? "fixed" : "flow"}
    >
      {children}
    </div>
  );
}
