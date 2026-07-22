// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  listManagedShares: vi.fn(),
  getManagedShare: vi.fn(),
  deleteManagedShare: vi.fn(),
}));

vi.mock("@/data/plan-database", () => database);

import { ManagedSharesPanel } from "@/features/ticket/managed-shares-panel";

const fingerprint = "f".repeat(64);
const slug = `${"S".repeat(21)}A`;
const revokeToken = "R".repeat(43);

beforeEach(() => {
  database.listManagedShares.mockReset().mockResolvedValue([
    {
      fingerprint,
      slug,
      expiresAt: "2099-07-22T00:00:00.000Z",
      createdAt: "2026-07-22T00:00:00.000Z",
      canRevoke: true,
    },
  ]);
  database.getManagedShare.mockReset().mockResolvedValue({
    fingerprint,
    slug,
    expiresAt: "2099-07-22T00:00:00.000Z",
    createdAt: "2026-07-22T00:00:00.000Z",
    idempotencyKey: `${"I".repeat(21)}A`,
    revokeToken,
  });
  database.deleteManagedShare.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("managed shares panel", () => {
  it("revokes with the local capability, then deletes both local records without rendering it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal("fetch", fetchMock);
    const onRevoked = vi.fn();
    render(<ManagedSharesPanel refreshKey={0} onRevoked={onRevoked} />);

    expect(await screen.findByRole("link", { name: /티켓 SSSSSS… 열기/u })).toHaveAttribute(
      "href",
      `/s/${slug}`,
    );
    expect(document.body.textContent).not.toContain(revokeToken);

    fireEvent.click(screen.getByRole("button", { name: "링크 폐기" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "링크 폐기" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/shares/${slug}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${revokeToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      }),
    );
    await waitFor(() => expect(database.deleteManagedShare).toHaveBeenCalledWith(fingerprint));
    expect(onRevoked).toHaveBeenCalledWith(fingerprint);
    expect(
      await screen.findByText("이 브라우저에서 관리 중인 공유 링크가 없습니다."),
    ).toBeVisible();
    expect(document.body.textContent).not.toContain(revokeToken);
  });
});
