import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, NetworkFirst, NetworkOnly, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const networkOnlyChunkPrefixes = [
  "/_next/static/chunks/app/api/",
  "/_next/static/chunks/app/s/",
  "/_next/static/chunks/app/search/",
];

const isNetworkOnlyChunk = (pathname: string) =>
  networkOnlyChunkPrefixes.some((prefix) => pathname.startsWith(prefix));

const neverCache = ({ request, url }: { request: Request; url: URL }) =>
  request.method !== "GET" ||
  url.pathname.startsWith("/api/") ||
  url.pathname.startsWith("/s/") ||
  url.pathname.startsWith("/search") ||
  isNetworkOnlyChunk(url.pathname) ||
  url.pathname.startsWith("/opengraph-image");

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: neverCache,
      handler: new NetworkOnly(),
      method: "GET",
    },
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        request.method === "GET" &&
        !isNetworkOnlyChunk(url.pathname) &&
        (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")),
      handler: new CacheFirst({ cacheName: "singsong-static-v2" }),
      method: "GET",
    },
    {
      matcher: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        ["/", "/ticket", "/import", "/offline"].includes(url.pathname),
      handler: new NetworkFirst({ cacheName: "singsong-shell-v1", networkTimeoutSeconds: 3 }),
      method: "GET",
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline.html",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.addEventListeners();
