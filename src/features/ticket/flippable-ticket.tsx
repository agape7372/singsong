"use client";

import { useState } from "react";
import type { KeyboardEvent, Ref } from "react";
import type { SharedSnapshot } from "@/domain/models";
import { TicketCard } from "./ticket-card";
import { TicketBack } from "./ticket-back";

type FlippableTicketProps = {
  payload: SharedSnapshot;
  fingerprint?: string;
  testData?: boolean;
  headingLevel: "h1" | "h2" | "h3";
  animate?: boolean;
  /** When false, renders a static front with no flip (import preview / export). */
  interactive?: boolean;
  /** Forwarded to the front TicketCard element — used by the PNG export capture. */
  frontRef?: Ref<HTMLElement>;
};

export function FlippableTicket({
  payload,
  fingerprint,
  testData = false,
  headingLevel,
  animate = false,
  interactive = true,
  frontRef,
}: FlippableTicketProps) {
  const [flipped, setFlipped] = useState(false);

  const front = (
    <TicketCard
      ref={frontRef}
      payload={payload}
      fingerprint={fingerprint}
      animate={animate}
      testData={testData}
      headingLevel={headingLevel}
    />
  );

  if (!interactive) {
    return front;
  }

  function toggle() {
    setFlipped((value) => !value);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggle();
    }
  }

  return (
    <div className="flip-scene">
      {/* Rich flow content (article/ol/dl) can't live inside <button>, so this is
          a role=button region with explicit keyboard handling. */}
      <div
        className="flip-toggle"
        role="button"
        tabIndex={0}
        aria-pressed={flipped}
        aria-label={flipped ? "티켓 앞면 보기" : "티켓 뒷면 상세 보기"}
        onClick={toggle}
        onKeyDown={onKeyDown}
      >
        <div className="flip-inner" data-flipped={flipped}>
          <div className="flip-face flip-front">{front}</div>
          <div className="flip-face flip-back" aria-hidden={!flipped}>
            <TicketBack payload={payload} headingLevel={headingLevel} />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        {flipped ? "티켓 뒷면 · 상세" : "티켓 앞면"}
      </span>
    </div>
  );
}
