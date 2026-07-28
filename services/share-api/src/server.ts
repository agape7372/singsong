import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createShareApi } from "./app.js";
import { createNodeServer } from "./node-server.js";
import { createRuntime } from "./runtime-config.js";

export async function startServer(environment = process.env) {
  const runtime = createRuntime(environment);
  const app = createShareApi(runtime);
  const server = createNodeServer(app);
  const port = Number(environment.PORT ?? "8787");
  const host = environment.HOST ?? "127.0.0.1";
  if (!Number.isSafeInteger(port) || port < 0 || port > 65_535) {
    throw new Error("PORT is invalid");
  }
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListen();
    });
  });
  const address = server.address();
  const boundPort = typeof address === "object" && address ? address.port : port;
  console.info(JSON.stringify({ event: "server_started", host, port: boundPort }));
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await startServer();
}
