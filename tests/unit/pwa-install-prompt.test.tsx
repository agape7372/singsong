// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

function setNavigator({
  userAgent,
  platform,
  maxTouchPoints = 0,
  standalone = false,
}: {
  userAgent: string;
  platform: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}) {
  Object.defineProperty(navigator, "userAgent", { configurable: true, value: userAgent });
  Object.defineProperty(navigator, "platform", { configurable: true, value: platform });
  Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, value: maxTouchPoints });
  Object.defineProperty(navigator, "standalone", { configurable: true, value: standalone });
}

function setStandaloneDisplay(matches: boolean) {
  const matchMedia = vi.fn((query: string) => ({
    matches: query === "(display-mode: standalone)" && matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  Object.defineProperty(window, "matchMedia", { configurable: true, value: matchMedia });
  return matchMedia;
}

function dispatchInstallPrompt({ reject = false }: { reject?: boolean } = {}) {
  const prompt = reject
    ? vi.fn(async () => {
        throw new Error("blocked");
      })
    : vi.fn(async () => undefined);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  Object.assign(event, {
    prompt,
    userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
  });
  act(() => window.dispatchEvent(event));
  return { event, prompt };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_PWA_ENABLED", "true");
  navigation.pathname = "/";
  window.localStorage.clear();
  setStandaloneDisplay(false);
  setNavigator({
    userAgent:
      "Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
    platform: "Linux armv8l",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("PwaInstallPrompt", () => {
  it("uses the Android install event only after an explicit user action", async () => {
    render(<PwaInstallPrompt />);
    const { event, prompt } = dispatchInstallPrompt();

    expect(await screen.findByRole("button", { name: "설치하기" })).toBeInTheDocument();
    expect(event.defaultPrevented).toBe(true);
    expect(prompt).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "설치하기" }));

    await waitFor(() => expect(prompt).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "설치하기" })).not.toBeInTheDocument(),
    );
  });

  it("shows honest iOS Safari steps and remembers an explicit dismissal", async () => {
    navigation.pathname = "/library";
    setNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    });
    render(<PwaInstallPrompt />);

    fireEvent.click(await screen.findByRole("button", { name: "설치 방법 보기" }));

    expect(screen.getByText(/Safari 아래쪽의 공유 버튼/)).toBeInTheDocument();
    expect(screen.getByText(/홈 화면 앱으로 자동 이동하지 않을 수 있어요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "설치 배너 닫기" }));
    expect(screen.queryByLabelText("앱 설치 안내")).not.toBeInTheDocument();
    expect(window.localStorage.length).toBe(1);
  });

  it("never appears on immersive routes or in standalone display mode", async () => {
    navigation.pathname = "/ticket";
    setNavigator({
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1",
      platform: "iPhone",
      maxTouchPoints: 5,
    });
    const matchMedia = setStandaloneDisplay(false);
    render(<PwaInstallPrompt />);

    await waitFor(() => expect(matchMedia).toHaveBeenCalled());
    expect(screen.queryByLabelText("앱 설치 안내")).not.toBeInTheDocument();

    cleanup();
    navigation.pathname = "/";
    setStandaloneDisplay(true);
    render(<PwaInstallPrompt />);
    await act(async () => undefined);
    expect(screen.queryByLabelText("앱 설치 안내")).not.toBeInTheDocument();
  });

  it("keeps a local error next to the Android action when the prompt cannot open", async () => {
    render(<PwaInstallPrompt />);
    dispatchInstallPrompt({ reject: true });

    fireEvent.click(await screen.findByRole("button", { name: "설치하기" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("설치 창을 열지 못했어요");
  });
});
