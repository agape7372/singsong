"use client";

import { useEffect, useState } from "react";
import { observeProfile, type ProfileRecord } from "@/data/plan-database";

const EMPTY_PROFILE: ProfileRecord = {
  id: "me",
  nickname: "",
  colorId: "rose",
  updatedAt: "1970-01-01T00:00:00.000Z",
};

/** Subscribes to the device-local profile. Never leaves the browser. */
export function useProfile(): ProfileRecord {
  const [profile, setProfile] = useState<ProfileRecord>(EMPTY_PROFILE);

  useEffect(() => {
    const unsubscribe = observeProfile(
      (next) => setProfile(next),
      () => setProfile(EMPTY_PROFILE),
    );
    return unsubscribe;
  }, []);

  return profile;
}
