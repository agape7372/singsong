// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogTrack } from "@/features/catalog/types";

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

import { SearchLedger } from "@/features/plan/search-ledger";

const results: CatalogTrack[] = [
  {
    id: "fx-001",
    title: "밤의 체크인",
    artist: "유리별",
    karaokeCodes: { TJ: "91001" },
    source: "fixture",
  },
  {
    id: "fx-002",
    title: "분홍 영수증",
    artist: "모서리",
    karaokeCodes: { KY: "92002" },
    source: "fixture",
  },
];

function renderLedger(overrides: Partial<ComponentProps<typeof SearchLedger>> = {}) {
  const props: ComponentProps<typeof SearchLedger> = {
    onAdd: vi.fn(async () => true),
    onManualAdd: vi.fn(async () => true),
    onUndoCatalogAdd: vi.fn(async () => true),
    isManualDuplicate: vi.fn(() => false),
    addedCatalogIds: new Set<string>(),
    isFull: false,
    ...overrides,
  };
  return { ...render(<SearchLedger {...props} />), props };
}

async function finishDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SearchLedger state semantics", () => {
  it("keeps one live status line and renders an added result as non-interactive text", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { props } = renderLedger({ addedCatalogIds: new Set(["fx-001"]) });

    expect(screen.getByRole("status")).toHaveTextContent("검색어는 주소나 로그에 남기지 않습니다.");
    const input = screen.getByLabelText("제목, 가수 또는 노래방 번호로 곡 찾기");
    fireEvent.change(input, { target: { value: "밤의" } });
    await finishDebounce();

    expect(screen.getByRole("status")).toHaveTextContent("검색 결과 2곡");
    const list = screen.getByRole("list", { name: "검색 결과 2개" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);

    const added = screen.getByLabelText("밤의 체크인, 유리별 담김");
    expect(added.tagName).toBe("SPAN");
    expect(added).toHaveTextContent("✓ 담김");
    expect(screen.queryByRole("button", { name: /밤의 체크인.*담김/u })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "분홍 영수증, 모서리 담기" }));
    await act(async () => undefined);
    expect(props.onAdd).toHaveBeenCalledWith(results[1]);
  });

  it("announces a search failure next to retry and plan recovery actions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("네트워크 연결을 확인해 주세요."))),
    );
    renderLedger();

    fireEvent.change(screen.getByLabelText("제목, 가수 또는 노래방 번호로 곡 찾기"), {
      target: { value: "밤의" },
    });
    await finishDebounce();

    expect(screen.getByRole("alert")).toHaveTextContent("네트워크 연결을 확인해 주세요.");
    expect(screen.getByRole("button", { name: "다시 시도" })).toBeVisible();
    expect(screen.getByRole("link", { name: "플랜에서 계속하기" })).toHaveAttribute("href", "/");
  });

  it("does not request during Korean composition and searches after composition ends", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderLedger();

    const input = screen.getByLabelText("제목, 가수 또는 노래방 번호로 곡 찾기");
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "밤의" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    fireEvent.compositionEnd(input, { data: "의" });
    await finishDebounce();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("일치하는 테스트 곡이 없습니다.");
  });
});
