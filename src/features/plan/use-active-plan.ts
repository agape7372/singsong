"use client";

import { useCallback, useEffect, useState } from "react";
import type { Plan } from "@/domain/models";

type Mutation = (plan: Plan) => Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">;

const loadPlanDatabase = () => import("@/data/plan-database");

export function useActivePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let stopped = false;
    let stopObserving: () => void = () => undefined;
    void loadPlanDatabase()
      .then(({ observeActivePlan }) => {
        if (stopped) return;
        stopObserving = observeActivePlan(
          (nextPlan) => {
            setPlan(nextPlan);
            setError(null);
          },
          () =>
            setError(
              "이 브라우저의 저장소를 열 수 없습니다. 저장 공간과 시크릿 모드를 확인해 주세요.",
            ),
        );
      })
      .catch(() =>
        setError("이 브라우저의 저장소를 열 수 없습니다. 저장 공간과 시크릿 모드를 확인해 주세요."),
      );
    return () => {
      stopped = true;
      stopObserving();
    };
  }, []);

  const mutate = useCallback(
    async (mutation: Mutation, successNotice?: string) => {
      if (!plan || isSaving) return false;
      setIsSaving(true);
      setNotice(null);
      try {
        const { mutateActivePlan } = await loadPlanDatabase();
        const updated = await mutateActivePlan(plan.revision, mutation);
        setPlan(updated);
        if (successNotice) setNotice(successNotice);
        return true;
      } catch (caught) {
        const { RevisionConflictError } = await loadPlanDatabase();
        if (caught instanceof RevisionConflictError) {
          setError("다른 탭에서 세션이 바뀌었습니다. 최신 순서를 불러왔으니 내용을 확인해 주세요.");
        } else {
          setError("변경을 저장하지 못했습니다. 입력은 유지했으니 다시 시도해 주세요.");
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, plan],
  );

  return {
    plan,
    error,
    notice,
    isSaving,
    mutate,
    dismissError: () => setError(null),
    announce: setNotice,
  };
}
