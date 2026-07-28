import { createShareApi } from "../src/app.js";
import { createRuntime } from "../src/runtime-config.js";

let runtimeApp: ReturnType<typeof createShareApi> | undefined;

const handler = {
  fetch(request: Request) {
    runtimeApp ??= createShareApi(createRuntime());
    return runtimeApp.fetch(request);
  },
};

export default handler;
