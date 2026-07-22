export type RevisionSnapshot = { revision: number };

export async function waitForStablePlanRevision(
  readPlan: () => Promise<RevisionSnapshot>,
  yieldTurn: () => Promise<void>,
  maxReads = 8,
) {
  let previous: number | null = null;

  for (let readCount = 0; readCount < maxReads; readCount += 1) {
    const { revision } = await readPlan();
    if (previous === revision) return revision;
    previous = revision;
    await yieldTurn();
  }

  throw new Error("The active plan revision did not settle before the service-worker update");
}

type WorkerLike = { scriptURL: string } | null;
type RegistrationLike = {
  active: WorkerLike;
  installing: WorkerLike;
  waiting: WorkerLike;
  unregister: () => Promise<boolean>;
};
type ServiceWorkerRegistryLike = { getRegistrations: () => Promise<readonly RegistrationLike[]> };
type CacheStorageLike = {
  keys: () => Promise<string[]>;
  delete: (name: string) => Promise<boolean>;
};

const isSingSongWorker = (registration: RegistrationLike) =>
  [registration.active, registration.installing, registration.waiting].some((worker) => {
    if (!worker) return false;
    try {
      return new URL(worker.scriptURL, "https://singsong.invalid").pathname === "/sw.js";
    } catch {
      return false;
    }
  });

export async function unregisterSingSongPwa(
  serviceWorkers: ServiceWorkerRegistryLike,
  cacheStorage: CacheStorageLike,
) {
  const registrations = await serviceWorkers.getRegistrations();
  const cacheNames = await cacheStorage.keys();
  const unregisterResults = await Promise.all(
    registrations.filter(isSingSongWorker).map((registration) => registration.unregister()),
  );
  const removedCaches = await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName.startsWith("singsong-"))
      .map((cacheName) => cacheStorage.delete(cacheName)),
  );

  return {
    unregistered: unregisterResults.filter(Boolean).length,
    removedCaches: removedCaches.filter(Boolean).length,
  };
}
