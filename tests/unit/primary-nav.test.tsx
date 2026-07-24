// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { AnchorHTMLAttributes } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props} />
  ),
}));

import { PrimaryNav } from "@/components/planner-tabs";
import { SiteHeader } from "@/components/site-header";

afterEach(() => {
  cleanup();
  navigation.pathname = "/";
});

describe("PrimaryNav", () => {
  it("uses one four-item navigation DOM with icons, labels, and aria-current", () => {
    navigation.pathname = "/library";
    const { container } = render(<PrimaryNav />);

    expect(screen.getByRole("navigation", { name: "주요 화면" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getByRole("link", { name: "플랜" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "보관함" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "발견" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "설정" })).toBeInTheDocument();
    expect(container.querySelectorAll(".primary-nav-icon svg[aria-hidden='true']")).toHaveLength(4);
  });

  it("is absent from immersive routes", () => {
    navigation.pathname = "/ticket";
    render(<PrimaryNav />);

    expect(screen.queryByRole("navigation", { name: "주요 화면" })).not.toBeInTheDocument();
  });

  it("shares the task-route navigation inside the compact app header", () => {
    render(<SiteHeader />);

    const header = screen.getByRole("banner");
    expect(screen.getByRole("navigation", { name: "주요 화면" })).toHaveProperty(
      "parentElement",
      header.firstElementChild,
    );
    expect(screen.getByRole("link", { name: "싱송 플랜 홈" })).toBeInTheDocument();
    expect(header.querySelector("img.wordmark-mark")).toHaveAttribute(
      "src",
      "/icons/folded-session-s-192.png",
    );
    expect(screen.getByText("이 기기에 자동 저장")).toBeInTheDocument();
  });
});
