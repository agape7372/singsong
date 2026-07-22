// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Plan, TicketSnapshot } from "@/domain/models";

const state = vi.hoisted(() => ({
  plan: null as unknown,
  planError: null as string | null,
  getTicket: vi.fn(),
  claimTicketMotion: vi.fn(),
  getManagedShareReceipt: vi.fn(),
  getManagedShare: vi.fn(),
  getActivePlan: vi.fn(),
  prepareManagedShare: vi.fn(),
  completeManagedShare: vi.fn(),
  rotateManagedShare: vi.fn(),
  deleteManagedShare: vi.fn(),
  toPng: vi.fn(),
}));

vi.mock("@/features/plan/use-active-plan", () => ({
  useActivePlan: () => ({ plan: state.plan, error: state.planError }),
}));

vi.mock("@/data/plan-database", () => ({
  getTicket: state.getTicket,
  claimTicketMotion: state.claimTicketMotion,
  getManagedShareReceipt: state.getManagedShareReceipt,
  getManagedShare: state.getManagedShare,
  getActivePlan: state.getActivePlan,
  prepareManagedShare: state.prepareManagedShare,
  completeManagedShare: state.completeManagedShare,
  rotateManagedShare: state.rotateManagedShare,
  deleteManagedShare: state.deleteManagedShare,
}));

vi.mock("@/features/ticket/managed-shares-panel", () => ({
  ManagedSharesPanel: () => <aside>내 공유 관리 테스트 대역</aside>,
}));

vi.mock("@/features/ticket/ticket-card", async () => {
  const React = await import("react");
  return {
    TicketCard: React.forwardRef<
      HTMLElement,
      {
        fingerprint?: string;
        animate?: boolean;
        headingLevel?: "h1" | "h2" | "h3";
      }
    >(function FakeTicketCard({ fingerprint, animate, headingLevel = "h1" }, ref) {
      const Heading = headingLevel;
      return (
        <article
          ref={ref}
          data-animate={String(Boolean(animate))}
          aria-labelledby="fake-ticket-heading"
        >
          <Heading id="fake-ticket-heading">오늘의 세션 스트립</Heading>
          <p>티켓 일련번호 · {fingerprint}</p>
        </article>
      );
    }),
  };
});

vi.mock("@/features/share/turnstile-challenge", async () => {
  const React = await import("react");
  return {
    TurnstileChallenge: React.forwardRef(function FakeTurnstile() {
      return <div>사람 확인 테스트 대역</div>;
    }),
  };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

vi.mock("html-to-image", () => ({ toPng: state.toPng }));
vi.mock("@/analytics/port", () => ({ trackAnalytics: vi.fn() }));

import { TicketScreen } from "@/features/ticket/ticket-screen";

function plan(revision: number): Plan {
  return {
    id: "active-plan",
    revision,
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
    people: 2,
    pricing: { kind: "song", singlePriceWon: 1_000 },
    items: [
      {
        id: `track-${revision}`,
        source: "manual",
        catalogSongId: null,
        title: `노래 ${revision}`,
        artist: "가수",
        karaokeCodes: [],
        order: 0,
      },
    ],
  };
}

function ticket(revision: number, fingerprint = String(revision).repeat(64)): TicketSnapshot {
  return {
    planId: "active-plan",
    revision,
    payload: {
      schemaVersion: 1,
      artworkSeed: "AAAAAAAAAAAAAAAAAAAAAA",
      items: [
        {
          source: "manual",
          title: `노래 ${revision}`,
          artist: "가수",
          karaokeCodes: [],
          order: 0,
        },
      ],
      calculation: {
        modelVersion: "fallback-v1",
        songCount: 1,
        duration: { lowSec: 165, midpointSec: 210, highSec: 255, coverageBps: 0 },
        pricing: { kind: "song", singlePriceWon: 1_000 },
        people: 2,
        derived: {
          totalLowWon: 1_000,
          totalHighWon: 1_000,
          perPersonLowWon: 500,
          perPersonHighWon: 500,
        },
      },
    },
    canonicalPayload: "{}",
    artworkSeed: "AAAAAAAAAAAAAAAAAAAAAA",
    fingerprint,
    issueMotionClaimedAt: null,
    createdAt: "2026-07-22T00:00:00.000Z",
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_APP_PROFILE", "fixture");
  state.plan = plan(1);
  state.planError = null;
  [
    state.getTicket,
    state.claimTicketMotion,
    state.getManagedShareReceipt,
    state.getManagedShare,
    state.getActivePlan,
    state.prepareManagedShare,
    state.completeManagedShare,
    state.rotateManagedShare,
    state.deleteManagedShare,
    state.toPng,
  ].forEach((mock) => mock.mockReset());
  state.claimTicketMotion.mockResolvedValue(false);
  state.getManagedShareReceipt.mockResolvedValue(null);
  state.getManagedShare.mockResolvedValue(null);
  state.deleteManagedShare.mockResolvedValue(undefined);
  state.toPng.mockResolvedValue("data:image/png;base64,iVBORw0KGgo=");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("ticket share lifecycle", () => {
  it("ignores a cancelled older ticket lookup and renders only the new snapshot", async () => {
    const older = deferred<TicketSnapshot | undefined>();
    state.getTicket.mockImplementation((_: string, revision: number) =>
      revision === 1 ? older.promise : Promise.resolve(ticket(2)),
    );
    const view = render(<TicketScreen />);
    await waitFor(() => expect(state.getTicket).toHaveBeenCalledWith("active-plan", 1));

    state.plan = plan(2);
    view.rerender(<TicketScreen />);
    expect(await screen.findByText(/티켓 일련번호 · 2222/u)).toBeVisible();

    await act(async () => older.resolve(ticket(1)));
    expect(screen.queryByText(/티켓 일련번호 · 1111/u)).not.toBeInTheDocument();
    expect(screen.getByText(/티켓 일련번호 · 2222/u).closest("article")).toHaveAttribute(
      "data-animate",
      "false",
    );
  });

  it("requires disclosure consent and blocks a stale ticket immediately before creation", async () => {
    state.getTicket.mockResolvedValue(ticket(1));
    state.getActivePlan.mockResolvedValue(plan(2));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<TicketScreen />);

    const create = await screen.findByRole("button", { name: "공유 링크 발급" });
    expect(create).toBeDisabled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(create).toBeEnabled();
    fireEvent.click(create);

    expect(await screen.findByText(/이 티켓은 더 이상 최신 상태가 아닙니다/u)).toBeVisible();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(state.prepareManagedShare).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("names the renewed ticket screen and keeps every public-snapshot notice attached to consent", async () => {
    state.getTicket.mockResolvedValue(ticket(1));
    render(<TicketScreen />);

    expect(
      await screen.findByRole("heading", { level: 1, name: "한 장으로 건넬 준비가 됐어요." }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "오늘의 세션 스트립" })).toBeVisible();
    const disclosure = screen.getByRole("group", { name: "공유 전 꼭 확인하세요" });
    expect(within(disclosure).getByText(/서버에 고정된 사본으로 저장합니다/u)).toBeVisible();
    expect(within(disclosure).getByText(/로그인 없이 누구나 볼 수 있습니다/u)).toBeVisible();
    expect(within(disclosure).getByText(/곡 제목·가수·노래방 번호와 곡 순서/u)).toBeVisible();
    expect(within(disclosure).getByText(/링크는 30일 후 만료/u)).toBeVisible();
    expect(within(disclosure).getByText(/철회 키는 이 브라우저에만 저장/u)).toBeVisible();

    const consent = within(disclosure).getByRole("checkbox", {
      name: /위 공개 범위, 포함 정보, 30일 만료, 고정 사본과 철회 키 보관 방식/u,
    });
    expect(consent).toHaveAttribute("aria-describedby", "share-disclosure");
    const describedDisclosure = document.getElementById(
      consent.getAttribute("aria-describedby") ?? "",
    );
    expect(describedDisclosure).toBeInstanceOf(HTMLUListElement);
    expect(within(describedDisclosure!).getAllByRole("listitem")).toHaveLength(4);
    expect(consent).toHaveAccessibleDescription(/로그인 없이 누구나 볼 수 있습니다/u);
    expect(screen.getByRole("group", { name: "티켓 공유 작업" })).toHaveAccessibleDescription(
      "PNG 저장은 공유 링크를 만들거나 전송하지 않습니다.",
    );
  });

  it("rotates both pending capabilities on 409 and exposes a safe retry path", async () => {
    const snapshot = ticket(1);
    state.getTicket.mockResolvedValue(snapshot);
    state.getActivePlan.mockResolvedValue(plan(1));
    state.prepareManagedShare.mockResolvedValue({
      fingerprint: snapshot.fingerprint,
      idempotencyKey: `${"I".repeat(21)}A`,
      revokeToken: "R".repeat(43),
    });
    state.rotateManagedShare.mockResolvedValue({});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({ error: { message: "conflict" } }),
      }),
    );
    render(<TicketScreen />);

    const create = await screen.findByRole("button", { name: "공유 링크 발급" });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(create);

    await waitFor(() =>
      expect(state.rotateManagedShare).toHaveBeenCalledWith(snapshot.fingerprint),
    );
    expect(await screen.findByText(/안전하게 교체했습니다/u)).toBeVisible();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(create).toBeDisabled();
    expect(state.completeManagedShare).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("R".repeat(43));
  });

  it("includes a non-sensitive description in the native share payload", async () => {
    const snapshot = ticket(1);
    const slug = `${"S".repeat(21)}A`;
    state.getTicket.mockResolvedValue(snapshot);
    state.getManagedShareReceipt.mockResolvedValue({
      fingerprint: snapshot.fingerprint,
      slug,
      expiresAt: "2099-07-22T00:00:00.000Z",
      createdAt: "2026-07-22T00:00:00.000Z",
      canRevoke: true,
    });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    render(<TicketScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "링크 공유" }));
    await waitFor(() =>
      expect(share).toHaveBeenCalledWith({
        title: "싱송 세션 티켓",
        text: "함께 부를 싱송 세션 티켓이에요.",
        url: `http://localhost:3000/s/${slug}`,
      }),
    );
    Reflect.deleteProperty(navigator, "share");
  });

  it("pins every exported PNG to the light palette even when the page is dark", async () => {
    state.getTicket.mockResolvedValue(ticket(1));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    render(<TicketScreen />);

    fireEvent.click(await screen.findByRole("button", { name: "PNG 저장" }));

    await waitFor(() => expect(state.toPng).toHaveBeenCalledOnce());
    expect(state.toPng.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        width: 540,
        height: 675,
        pixelRatio: 2,
        backgroundColor: "#FFF",
        style: expect.objectContaining({
          colorScheme: "light",
          opacity: "1",
          transform: "none",
          "--paper": "#ffffff",
          "--ink": "#15131a",
          "--canvas": "#faf7f0",
          "--accent-fill": "#ff3d6e",
          "--money": "#b76e00",
          "--money-text": "#8a5200",
        }),
      }),
    );
    expect(click).toHaveBeenCalledOnce();
  });

  it("renders an actionable storage error instead of an endless loading state", () => {
    state.plan = null;
    state.planError = "IndexedDB unavailable";
    render(<TicketScreen />);

    expect(
      screen.getByRole("heading", { name: "이 브라우저의 티켓 저장소를 열 수 없어요." }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("저장 공간 권한");
    expect(screen.getByRole("button", { name: "페이지 다시 시도" })).toBeVisible();
    expect(screen.getByRole("link", { name: "세션으로 돌아가기" })).toHaveAttribute("href", "/");
  });
});
