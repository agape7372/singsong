import "server-only";

type SafeEvent = {
  event: "api_request" | "share_store" | "share_revoke";
  requestId: string;
  route: "/api/search" | "/api/shares" | "/api/shares/[slug]" | "/api/shares/[slug]/revoke";
  status: number;
  durationMs?: number;
};

export function safeLog(event: SafeEvent) {
  const record = { ...event, at: new Date().toISOString() };
  if (event.status >= 500) console.error(JSON.stringify(record));
  else console.info(JSON.stringify(record));
}
