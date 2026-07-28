import {
  createNodeServer,
  createRuntime,
  createShareApi,
} from "../../services/share-api/dist/index.js";

const host = "127.0.0.1";
const port = Number.parseInt(process.env.PORT ?? "", 10);

if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("PORT must be a valid TCP port");
}

const runtime = createRuntime(process.env);
const server = createNodeServer(createShareApi(runtime));

function shutdown() {
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

server.listen(port, host, () => {
  console.info(`SingSong fixture share API listening at http://${host}:${port}`);
});
