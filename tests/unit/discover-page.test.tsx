// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import DiscoverPage from "@/app/discover/page";

afterEach(cleanup);

describe("Discover curation (TEST DATA)", () => {
  it("shows dummy themed playlists that are honestly marked as test data", () => {
    render(<DiscoverPage />);

    expect(screen.getByRole("heading", { level: 1, name: "발견" })).toBeVisible();
    // Honesty: visibly marked as fictional test data, not a real catalog.
    expect(screen.getByText("TEST DATA")).toBeVisible();
    expect(screen.getByText(/실제 셀럽·차트가 아니라 테스트 곡/u)).toBeVisible();

    // Fictional themed playlists are present and addable.
    expect(screen.getByRole("heading", { level: 2, name: "회식 마무리 떼창" })).toBeVisible();
    expect(screen.getAllByRole("button", { name: "플레이리스트 담기" }).length).toBeGreaterThan(0);
  });
});
