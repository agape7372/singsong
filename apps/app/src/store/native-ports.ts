import * as Crypto from "expo-crypto";

import type { DomainPorts } from "@singsong/domain";
import type { StorePorts } from "@singsong/store";

export const nativeDomainPorts: DomainPorts = {
  randomBytes(byteLength) {
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new RangeError("난수 바이트 길이가 잘못됐습니다.");
    }
    return Crypto.getRandomValues(new Uint8Array(byteLength));
  },
  async digest(bytes) {
    // TS 6은 Uint8Array<ArrayBufferLike>를 SharedArrayBuffer 가능 타입으로 본다.
    // 네이티브 브리지에는 소유 ArrayBuffer를 가진 사본만 넘겨 BufferSource 계약을 고정한다.
    const input = new Uint8Array(bytes.byteLength);
    input.set(bytes);
    const result = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, input);
    return new Uint8Array(result);
  },
  now: Date.now,
};

export const nativeStorePorts: StorePorts = {
  randomBytes: nativeDomainPorts.randomBytes,
  randomId: Crypto.randomUUID,
  now: nativeDomainPorts.now,
};
