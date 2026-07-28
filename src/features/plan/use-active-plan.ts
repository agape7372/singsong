"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "@/domain/models";

type Mutation = (plan: Plan) => Omit<Plan, "id" | "revision" | "createdAt" | "updatedAt">;
type SuccessNotice = string | ((plan: Plan) => string);

const loadPlanDatabase = () => import("@/data/plan-database");

export function useActivePlan() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 저장은 직렬로 처리한다. 큐가 없으면 앞선 IndexedDB 쓰기가 끝나기 전에 들어온
  // 담기 탭이 조용히 버려져서, 연타할수록 곡이 빠지고 순서가 뒤섞여 보인다.
  const planRef = useRef<Plan | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pendingRef = useRef(0);

  useEffect(() => {
    let stopped = false;
    let stopObserving: () => void = () => undefined;
    void loadPlanDatabase()
      .then(({ observeActivePlan }) => {
        if (stopped) return;
        stopObserving = observeActivePlan(
          (nextPlan) => {
            // 큐가 도는 중에 도착한 낡은 스냅샷은 무시한다. 그렇지 않으면
            // 다음 뮤테이션이 예전 revision으로 충돌을 일으킨다.
            const current = planRef.current;
            if (current && current.id === nextPlan.id && nextPlan.revision < current.revision) {
              return;
            }
            planRef.current = nextPlan;
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

  const mutate = useCallback(async (mutation: Mutation, successNotice?: SuccessNotice) => {
    if (!planRef.current) return false;

    pendingRef.current += 1;
    setIsSaving(true);

    const run = async (): Promise<boolean> => {
      // 큐에서 실행되는 시점의 최신 플랜을 읽는다(렌더 클로저의 낡은 revision 금지).
      const current = planRef.current;
      if (!current) return false;
      setNotice(null);
      try {
        const { mutateActivePlan } = await loadPlanDatabase();
        const updated = await mutateActivePlan(current.revision, mutation);
        planRef.current = updated;
        setPlan(updated);
        if (successNotice) {
          setNotice(typeof successNotice === "function" ? successNotice(updated) : successNotice);
        }
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
        pendingRef.current -= 1;
        if (pendingRef.current === 0) setIsSaving(false);
      }
    };

    const queued = queueRef.current.then(run, run);
    queueRef.current = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }, []);

  return {
    plan,
    // 렌더 상태보다 앞선 최신 스냅샷. 연타 중 중복/상한 검사는 이걸로 해야 한다.
    getPlan: () => planRef.current,
    error,
    notice,
    isSaving,
    mutate,
    dismissError: () => setError(null),
    announce: setNotice,
  };
}
