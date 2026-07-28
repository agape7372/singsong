import { useCallback, useEffect, useRef, useState } from "react";

import type { Plan } from "@singsong/domain";
import {
  getActivePlan,
  mutateActivePlan,
  RevisionConflictError,
  type PlanStore,
} from "@singsong/store";

import { useNativeStore } from "@/store/store-provider";

export type PlanDraft = Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">;
export type PlanMutation = (current: Plan) => PlanDraft;

/**
 * 저장소 CAS 위에 화면 액션 큐를 한 겹 둔다. 빠르게 두 버튼을 눌렀을 때 React
 * 구독 스냅샷이 아직 이전 revision이어도 두 번째 액션은 첫 번째 반환값을 기준으로
 * 이어진다. 다른 구독자가 먼저 쓴 충돌은 최신 plan을 읽고 한 번만 재적용한다.
 */
export function usePlanEditor() {
  const snapshot = useNativeStore();
  const storeRef = useRef<PlanStore | null>(null);
  const planRef = useRef<Plan | null>(null);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (snapshot.status !== "ready") return;
    storeRef.current = snapshot.store;
    if (planRef.current === null || snapshot.plan.revision >= planRef.current.revision) {
      planRef.current = snapshot.plan;
    }
  }, [snapshot]);

  const mutate = useCallback((mutation: PlanMutation): Promise<Plan> => {
    setPendingCount((count) => count + 1);
    const run = queueRef.current.then(async () => {
      const store = storeRef.current;
      let current = planRef.current;
      if (!store || !current) throw new Error("플랜 저장소를 아직 준비하고 있습니다.");

      try {
        const next = await mutateActivePlan(store, current.revision, mutation);
        planRef.current = next;
        return next;
      } catch (error) {
        if (!(error instanceof RevisionConflictError)) throw error;
        current = await getActivePlan(store);
        const next = await mutateActivePlan(store, current.revision, mutation);
        planRef.current = next;
        return next;
      }
    });
    queueRef.current = run.then(
      () => undefined,
      () => undefined,
    );
    void run.then(
      () => setPendingCount((count) => Math.max(0, count - 1)),
      () => setPendingCount((count) => Math.max(0, count - 1)),
    );
    return run;
  }, []);

  const getPlan = useCallback(() => planRef.current, []);

  return {
    snapshot,
    plan: snapshot.status === "ready" ? snapshot.plan : null,
    store: snapshot.status === "ready" ? snapshot.store : null,
    isSaving: pendingCount > 0,
    getPlan,
    mutate,
  };
}
