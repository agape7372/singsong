// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ProfileRecord } from "@/data/plan-database";
import {
  PROFILE_COLORS,
  ProfileAvatar,
  profileColor,
  profileInitial,
} from "@/features/profile/profile-avatar";

afterEach(cleanup);

function makeProfile(overrides: Partial<ProfileRecord> = {}): ProfileRecord {
  return {
    id: "me",
    nickname: "",
    colorId: "rose",
    updatedAt: "1970-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("profile helpers", () => {
  it("uses the first grapheme of the nickname, falling back to 나", () => {
    expect(profileInitial("지민")).toBe("지");
    expect(profileInitial("  ")).toBe("나");
    expect(profileInitial("")).toBe("나");
  });

  it("resolves a known palette color and falls back to the first", () => {
    expect(profileColor("teal").id).toBe("teal");
    expect(profileColor("does-not-exist")).toBe(PROFILE_COLORS[0]);
  });
});

describe("ProfileAvatar", () => {
  it("renders an initial chip with the profile color and accessible name", () => {
    render(<ProfileAvatar profile={makeProfile({ nickname: "지민", colorId: "teal" })} />);
    const avatar = screen.getByRole("img", { name: "지민" });
    expect(avatar).toHaveClass("profile-avatar-initial");
    expect(avatar).toHaveTextContent("지");
  });

  it("represents an empty profile as the local user", () => {
    render(<ProfileAvatar profile={makeProfile()} />);
    const avatar = screen.getByRole("img", { name: "나" });
    expect(avatar).toHaveTextContent("나");
  });
});
