"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export function AppHeaderActions({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => {
      setTarget(document.querySelector<HTMLElement>("[data-app-header-actions]"));
    });
    return () => window.cancelAnimationFrame(animationFrame);
  }, []);

  return target ? createPortal(children, target) : null;
}
