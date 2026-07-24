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
  it("opens the search sheet from the single empty action", () => {
    const onOpenSearch = vi.fn();
    render(
      <WorkingStrip
        items={[]}
        people={null}
        disabled={false}
        onAddPerson={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onOpenSearch={onOpenSearch}
        undoLabel={null}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "오늘 뭐 부를래?" })).toBeVisible();
    expect(screen.getByText("노래 찾아서 담아봐, 여기 리스트가 채워질 거야")).toBeVisible();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    const action = screen.getByRole("button", { name: "노래 찾으러 가기" });
    fireEvent.click(action);
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  it("uses the station ledger hierarchy while preserving add, remove, undo and reorder", () => {
    const onMove = vi.fn();
    const onRemove = vi.fn();
    const onUndo = vi.fn();
    const onAddPerson = vi.fn();
    const onOpenSearch = vi.fn();
    render(
      <WorkingStrip
        items={tracks}
        people={4}
        disabled={false}
        onAddPerson={onAddPerson}
        onMove={onMove}
        onRemove={onRemove}
        onOpenSearch={onOpenSearch}
        undoLabel="분홍 영수증"
        onUndo={onUndo}
      />,
    );

    expect(screen.getByRole("heading", { name: "SINGSONG" })).toBeVisible();
    expect(screen.getByText("A", { selector: ".station-ledger-badge" })).toBeVisible();
    expect(screen.getByText("2", { selector: ".station-ledger-count" })).toHaveAccessibleName(
      "2곡",
    );
    expect(screen.getByRole("list", { name: "참여자 4명" })).toBeVisible();
    expect(screen.queryByText("함께하는 사람")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인원 줄이기" })).not.toBeInTheDocument();
    expect(screen.queryByText("QUEUE / 01")).not.toBeInTheDocument();
    expect(screen.queryByText("02 / 100")).not.toBeInTheDocument();
    expect(screen.queryByText("TJ 100001")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "참여자 한 명 추가" }));
    expect(onAddPerson).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "밤의 체크인 한 칸 위로" })).toBeDisabled();
    const firstTrackRow = screen.getByText("밤의 체크인").closest("li");
    expect(firstTrackRow).not.toBeNull();
    fireEvent.keyDown(firstTrackRow!, { key: "ArrowDown", altKey: true });
    expect(onMove).toHaveBeenCalledWith(0, 1);
    const addMore = screen.getByRole("button", { name: "곡 하나 더 넣기" });
    expect(screen.getByText("+", { selector: ".strip-add-plus" })).toBeVisible();
    fireEvent.click(addMore);
    expect(onOpenSearch).toHaveBeenCalledOnce();
    expect(screen.queryByText("빼기")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "분홍 영수증 삭제" }).querySelector("[aria-hidden]"),
    ).toHaveTextContent("×");
    fireEvent.click(screen.getByRole("button", { name: "분홍 영수증 삭제" }));
    expect(onRemove).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button", { name: "되돌리기" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("uses a compact overflow avatar and disables quick add at the participant limit", () => {
    const onAddPerson = vi.fn();
    render(
      <WorkingStrip
        items={tracks}
        people={30}
        disabled={false}
        onAddPerson={onAddPerson}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onOpenSearch={vi.fn()}
        undoLabel={null}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByRole("list", { name: "참여자 30명" })).toBeVisible();
    expect(screen.getByText("+25", { selector: "[aria-hidden='true']" })).toBeVisible();
    const addButton = screen.getByRole("button", { name: "참여자는 최대 30명입니다" });
    expect(addButton).toBeDisabled();
    fireEvent.click(addButton);
    expect(onAddPerson).not.toHaveBeenCalled();
  });

  it("represents an unset participant count as the local user", () => {
    render(
      <WorkingStrip
        items={tracks}
        people={null}
        disabled={false}
        onAddPerson={vi.fn()}
        onMove={vi.fn()}
        onRemove={vi.fn()}
        onOpenSearch={vi.fn()}
        undoLabel={null}
        onUndo={vi.fn()}
      />,
    );

    expect(screen.getByRole("list", { name: "참여자 1명" })).toBeVisible();
    expect(screen.getByText("나", { selector: "[aria-hidden='true']" })).toBeVisible();
  });
});
