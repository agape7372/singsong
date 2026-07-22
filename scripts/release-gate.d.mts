export declare const RELEASE_REQUIRED_ENV: readonly string[];

export declare class ReleaseGateError extends Error {
  readonly code: "BLOCK_EXTERNAL";
  readonly blockers: readonly string[];
  constructor(blockers: readonly string[]);
}

export declare function collectReleaseBlockers(
  env?: NodeJS.ProcessEnv,
  options?: { cwd?: string; now?: Date },
): readonly string[];

export declare function assertReleaseEnvironment(
  env?: NodeJS.ProcessEnv,
  options?: { cwd?: string; now?: Date },
): void;
