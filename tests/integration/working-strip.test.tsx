// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/domain/models";
import { WorkingStrip } from "@/features/plan/working-strip";

afterEach(cleanup);

const tracks: Track[] = [
  {
    id: "track-1",
    source: "manual",
    catalogSongId: null,
    title: "밤의 체크인",
    artist: "싱송",
    karaokeCodes: [{ vendor: "TJ", code: "100001" }],
    order: 0,
  },
  {
    id: "track-2",
    source: "manual",
    catalogSongId: null,
    title: "분홍 영수증",
    artist: "싱송",
    karaokeCodes: [],
    order: 1,
  },
];

describe("WorkingStrip", () => {
  it("uses the canonical empty copy with exactly one search action", () => {
    render(
      <WorkingStrip
        items={[]}
        disabled={false}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        undoLabel={null}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "오늘 뭐 부를래?" })).toBeVisible();
    expect(screen.getByText("노래 찾아서 담아봐, 여기 리스트가 채워질 거야")).toBeVisible();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName("노래 찾으러 가기");
    expect(links[0]).toHaveAttribute("href", "/search");
  });

  it("preserves populated ledger move, remove and undo behavior", () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const onUndo = vi.fn();
    render(
      <WorkingStrip
        items={tracks}
        disabled={false}
        onMove={onMove}
        onRemove={onRemove}
        undoLabel="분홍 영수증"
        onUndo={onUndo}
      />,
    );

    expect(screen.getByText("02 / 100")).toBeVisible();
    expect(screen.getByText("TJ 100001")).toBeVisible();
    expect(screen.getByRole("button", { name: "밤의 체크인 한 칸 위로" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "밤의 체크인 한 칸 아래로" }));
    expect(onMove).toHaveBeenCalledWith(0, 1);
    fireEvent.click(screen.getByRole("button", { name: "분홍 영수증 삭제" }));
    expect(onRemove).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
