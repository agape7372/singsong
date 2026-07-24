"use client";

import { useEffect, useMemo } from "react";
import type { ProfileRecord } from "@/data/plan-database";

/** Restrained, CUTLINE-adjacent palette. Each chip carries white text at >=4.5:1. */
export const PROFILE_COLORS = [
  { id: "rose", label: "로즈", chip: "#C9295A" },
  { id: "ochre", label: "오커", chip: "#8A5200" },
  { id: "plum", label: "플럼", chip: "#6E3B73" },
  { id: "teal", label: "틸", chip: "#1F6259" },
  { id: "clay", label: "클레이", chip: "#A6482A" },
  { id: "ink", label: "잉크", chip: "#3A3340" },
] as const;

export function profileColor(colorId: string) {
  return PROFILE_COLORS.find((color) => color.id === colorId) ?? PROFILE_COLORS[0];
}

export function profileInitial(nickname: string) {
  const trimmed = nickname.trim();
  return trimmed.length > 0 ? Array.from(trimmed)[0] : "나";
}

export function ProfileAvatar({
  profile,
  size = 44,
  className,
}: {
  profile: ProfileRecord;
  size?: number;
  className?: string;
}) {
  const photoUrl = useMemo(
    () => (profile.photo ? URL.createObjectURL(profile.photo) : null),
    [profile.photo],
  );

  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const color = useMemo(() => profileColor(profile.colorId), [profile.colorId]);
  const initial = profileInitial(profile.nickname);
  const name = profile.nickname.trim() || "나";
  const style = { width: size, height: size } as const;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- device-local blob URL, never an optimizable remote asset
      <img
        className={className ? `profile-avatar ${className}` : "profile-avatar"}
        src={photoUrl}
        alt={name}
        width={size}
        height={size}
        style={style}
      />
    );
  }

  return (
    <span
      className={
        className
          ? `profile-avatar profile-avatar-initial ${className}`
          : "profile-avatar profile-avatar-initial"
      }
      style={{ ...style, background: color.chip }}
      role="img"
      aria-label={name}
    >
      <span aria-hidden="true">{initial}</span>
    </span>
  );
}
