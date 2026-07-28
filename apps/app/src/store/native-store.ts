import { openPlanStore, type PlanStore } from "@singsong/store";

import { nativeStorePorts } from "@/store/native-ports";
import { openNativeSqlExecutor } from "@/store/native-sql-executor";

let storePromise: Promise<PlanStore> | null = null;

/** 앱 프로세스당 SQLite 연결과 PlanStore를 정확히 한 벌만 연다. */
export function getNativePlanStore(): Promise<PlanStore> {
  if (!storePromise) {
    const opening = openNativeSqlExecutor().then(async (executor) => {
      try {
        return await openPlanStore(executor, nativeStorePorts);
      } catch (error) {
        try {
          await executor.close();
        } catch {
          // 마이그레이션의 원래 실패가 재시도 화면에 표시돼야 한다.
        }
        throw error;
      }
    });
    const guarded = opening.catch((error: unknown) => {
      if (storePromise === guarded) storePromise = null;
      throw error;
    });
    storePromise = guarded;
  }
  return storePromise;
}
