#!/usr/bin/env node
import {
  createNodeServer,
  createRuntime,
  createShareApi,
  fixtureSnapshot,
} from "../services/share-api/dist/index.js";

let app = {
  fetch() {
    return Promise.resolve(new Response("starting", { status: 503 }));
  },
};

const server = createNodeServer({
  fetch(request) {
    return app.fetch(request);
  },
});

function listen() {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function close() {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function jsonRequest(origin, path, body, extra = {}) {
  return fetch(`${origin}${path}`, {
    method: extra.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SingSong-Client": "fixture/0.1.0",
      ...extra.headers,
    },
    body: JSON.stringify(body),
  });
}

try {
  await listen();
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Smoke server did not bind TCP");
  const origin = `http://127.0.0.1:${address.port}`;
  app = createShareApi(createRuntime({ APP_PROFILE: "fixture", SITE_ORIGIN: origin }), {
    log() {},
  });

  const options = await fetch(`${origin}/api/shares`, { method: "OPTIONS" });
  check(options.status === 204, "OPTIONS did not return 204");
  check(!options.headers.has("access-control-allow-origin"), "OPTIONS enabled credentialless CORS");

  const search = await jsonRequest(origin, "/api/search", { query: "밤의 체크인" });
  check(search.status === 200, "Fixture search failed");
  const searchBody = await search.json();
  check(searchBody.dataSource === "fixture", "Fixture search did not identify its data source");

  const revokeToken = "B".repeat(43);
  const createdResponse = await jsonRequest(origin, "/api/shares", {
    idempotencyKey: "AAAAAAAAAAAAAAAAAAAAAA",
    revokeToken,
    payload: fixtureSnapshot(),
  });
  check(createdResponse.status === 201, "Share create failed");
  const created = await createdResponse.json();
  check(/^[A-Za-z0-9_-]{22}$/u.test(created.slug), "Share create returned an invalid slug");

  const fetched = await fetch(`${origin}/api/shares/${created.slug}`);
  check(fetched.status === 200, "Share read failed");
  check(fetched.headers.get("cache-control") === "no-store", "Share read can be cached");

  const landing = await fetch(`${origin}/s/${created.slug}`);
  const landingHtml = await landing.text();
  check(landing.status === 200, "Landing failed");
  check(
    landingHtml.includes(`${origin}/og/ticket-1200x630.png`),
    "Landing OG image is not absolute",
  );
  check(
    landing.headers.get("content-security-policy")?.includes("frame-ancestors 'none'"),
    "Landing CSP is missing frame denial",
  );

  const og = await fetch(`${origin}/og/ticket-1200x630.png`);
  check(og.status === 200 && og.headers.get("content-type") === "image/png", "Static OG failed");

  const revoked = await jsonRequest(
    origin,
    `/api/shares/${created.slug}/revoke`,
    {},
    { headers: { Authorization: `Bearer ${revokeToken}` } },
  );
  check(revoked.status === 204, "Share revoke failed");
  check(
    (await fetch(`${origin}/api/shares/${created.slug}`)).status === 404,
    "Revoked share remained readable",
  );

  process.stdout.write(
    `${JSON.stringify({
      status: "PASS",
      profile: "fixture",
      routes: [
        "POST /api/search",
        "POST /api/shares",
        "GET /api/shares/:slug",
        "POST /api/shares/:slug/revoke",
        "GET /s/:slug",
        "GET /og/ticket-1200x630.png",
        "OPTIONS",
      ],
    })}\n`,
  );
} finally {
  await close();
}
