import type { ReactNode } from "react";
import { useEffect, useSyncExternalStore } from "react";

import type { Plan } from "@singsong/domain";
import {
  getActivePlan,
  getProfile,
  observeActivePlan,
  observeProfile,
  type PlanStore,
  type StoredProfile,
} from "@singsong/store";

import { getNativePlanStore } from "@/store/native-store";

export type NativeStoreSnapshot =
  | {
      readonly status: "loading";
      readonly store: null;
      readonly plan: null;
      readonly profile: null;
      readonly error: null;
    }
  | {
      readonly status: "ready";
      readonly store: PlanStore;
      readonly plan: Plan;
      readonly profile: StoredProfile;
      readonly error: null;
    }
  | {
      readonly status: "error";
      readonly store: null;
      readonly plan: null;
      readonly profile: null;
      readonly error: Error;
    };

let snapshot: NativeStoreSnapshot = {
  status: "loading",
  store: null,
  plan: null,
  profile: null,
  error: null,
};
let bootPromise: Promise<void> | null = null;
let lifecycle = 0;
let stopObservers: (() => void)[] = [];
const listeners = new Set<() => void>();

function emit(next: NativeStoreSnapshot) {
  snapshot = next;
  for (const listener of [...listeners]) listener();
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function stopCurrentObservers() {
  lifecycle += 1;
  for (const stop of stopObservers.splice(0)) stop();
}

function initializeNativeStore(): Promise<void> {
  bootPromise ??= (async () => {
    const currentLifecycle = lifecycle + 1;
    lifecycle = currentLifecycle;
    try {
      const store = await getNativePlanStore();
      const [plan, profile] = await Promise.all([getActivePlan(store), getProfile(store)]);
      if (currentLifecycle !== lifecycle) return;
      emit({ status: "ready", store, plan, profile, error: null });

      const reportObserverError = (error: unknown) => {
        if (currentLifecycle !== lifecycle) return;
        stopCurrentObservers();
        bootPromise = null;
        emit({
          status: "error",
          store: null,
          plan: null,
          profile: null,
          error: normalizeError(error),
        });
      };
      stopObservers = [
        observeActivePlan(
          store,
          (nextPlan) => {
            if (currentLifecycle !== lifecycle || snapshot.status !== "ready") return;
            emit({ ...snapshot, plan: nextPlan });
          },
          reportObserverError,
        ),
        observeProfile(
          store,
          (nextProfile) => {
            if (currentLifecycle !== lifecycle || snapshot.status !== "ready") return;
            emit({ ...snapshot, profile: nextProfile });
          },
          reportObserverError,
        ),
      ];
    } catch (error) {
      if (currentLifecycle !== lifecycle) return;
      bootPromise = null;
      emit({
        status: "error",
        store: null,
        plan: null,
        profile: null,
        error: normalizeError(error),
      });
    }
  })();
  return bootPromise;
}

export function retryNativeStoreInitialization(): Promise<void> {
  stopCurrentObservers();
  bootPromise = null;
  emit({
    status: "loading",
    store: null,
    plan: null,
    profile: null,
    error: null,
  });
  return initializeNativeStore();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return snapshot;
}

export function NativeStoreProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void initializeNativeStore();
  }, []);
  return children;
}

export function useNativeStore(): NativeStoreSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
