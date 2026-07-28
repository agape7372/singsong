const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const OG_WIDTH = 1_200;
const OG_HEIGHT = 630;
const MAX_OG_BYTES = 1024 * 1024;

function uint32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset]! * 0x1_00_00_00 +
    bytes[offset + 1]! * 0x1_00_00 +
    bytes[offset + 2]! * 0x1_00 +
    bytes[offset + 3]!
  );
}

export function isApprovedOgPng(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 33 &&
    bytes.byteLength <= MAX_OG_BYTES &&
    PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) &&
    uint32(bytes, 8) === 13 &&
    bytes[12] === 0x49 &&
    bytes[13] === 0x48 &&
    bytes[14] === 0x44 &&
    bytes[15] === 0x52 &&
    uint32(bytes, 16) === OG_WIDTH &&
    uint32(bytes, 20) === OG_HEIGHT
  );
}
