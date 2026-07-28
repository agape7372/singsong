import type { SharedSnapshot } from "../domain.js";

export type ShareRecord = {
  slug: string;
  payload: SharedSnapshot;
  fingerprint: string;
  createdAt: string;
  expiresAt: string;
};

export type RateBucketHashes = { hour: string; day: string };

export type CreateShareInput = {
  idempotencyKey: string;
  revokeToken: string;
  payload: SharedSnapshot;
  canonicalPayload: string;
  fingerprint: string;
  rateBucketHashes?: RateBucketHashes;
};

export type CreateShareResult = ShareRecord & {
  revokeToken: string;
  isNew: boolean;
};

export type RevokeShareResult = "revoked" | "unavailable" | "rate_limited";
export type ShareInspection = "missing" | "reusable" | "conflict";
export type ShareRepositoryErrorCode = "RATE_LIMITED" | "CONFLICT" | "KEY_MISMATCH";

export class ShareRepositoryError extends Error {
  constructor(readonly code: ShareRepositoryErrorCode) {
    super(`Share repository error: ${code}`);
    this.name = "ShareRepositoryError";
  }
}

export interface ShareRepository {
  inspect(
    idempotencyKey: string,
    fingerprint: string,
    revokeToken: string,
  ): Promise<ShareInspection>;
  create(input: CreateShareInput): Promise<CreateShareResult>;
  get(slug: string): Promise<ShareRecord | null>;
  revoke(
    slug: string,
    token: string,
    rateBucketHashes?: RateBucketHashes,
  ): Promise<RevokeShareResult>;
}
