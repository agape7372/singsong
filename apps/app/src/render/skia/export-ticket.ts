import { ImageFormat } from "@shopify/react-native-skia";
import { File, Paths } from "expo-file-system";

import { formatMinuteRange, formatWonRange, type TicketSnapshot } from "@singsong/domain";
import { buildTicketScene, type TicketModel } from "@singsong/ticket-art";

import { rasterizeTicketScene } from "./index";

export const TICKET_PNG_WIDTH = 1080;
export const TICKET_PNG_HEIGHT = 1350;

const RENDER_VERSION = "m3-v1";
const pendingExports = new Map<string, Promise<File>>();

export function ticketModelFromSnapshot(ticket: TicketSnapshot): TicketModel {
  const calculation = ticket.payload.calculation;
  return {
    songCount: calculation.songCount,
    totalLabel: formatWonRange(calculation.derived.totalLowWon, calculation.derived.totalHighWon),
    durationLabel: `약 ${formatMinuteRange(
      calculation.duration.lowSec,
      calculation.duration.highSec,
    )}`,
    perPersonLabel: `1인 ${formatWonRange(
      calculation.derived.perPersonLowWon,
      calculation.derived.perPersonHighWon,
    )}`,
    serial: ticket.fingerprint.slice(0, 10).toUpperCase(),
    testData: true,
  };
}

export function isPng(bytes: Uint8Array) {
  return (
    bytes.byteLength >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function cacheFile(ticket: TicketSnapshot) {
  const fingerprint = ticket.fingerprint
    .toLowerCase()
    .replace(/[^a-f0-9]/gu, "")
    .slice(0, 24);
  return new File(Paths.cache, `singsong-ticket-${RENDER_VERSION}-${fingerprint}.png`);
}

async function renderAndCache(ticket: TicketSnapshot) {
  const target = cacheFile(ticket);
  if (target.exists && target.size >= 64) return target;

  const scene = buildTicketScene(ticketModelFromSnapshot(ticket), {
    width: TICKET_PNG_WIDTH,
    height: TICKET_PNG_HEIGHT,
    variant: "export",
  });
  const image = rasterizeTicketScene(scene);
  try {
    if (image.width() !== TICKET_PNG_WIDTH || image.height() !== TICKET_PNG_HEIGHT) {
      throw new Error(`티켓 PNG 크기가 올바르지 않아요: ${image.width()}×${image.height()}`);
    }
    const encoded = image.encodeToBytes(ImageFormat.PNG, 100);
    const png = new Uint8Array(encoded.byteLength);
    png.set(encoded);
    if (!isPng(png)) throw new Error("Skia가 유효한 PNG를 반환하지 않았어요.");

    target.create({ intermediates: true, overwrite: true });
    target.write(png);
    return target;
  } finally {
    image.dispose();
  }
}

/**
 * Produces a deterministic private artifact in the app cache. Concurrent save
 * and share taps for the same frozen snapshot share one CPU render.
 */
export function exportTicketPng(ticket: TicketSnapshot): Promise<File> {
  const key = ticket.fingerprint;
  const existing = pendingExports.get(key);
  if (existing) return existing;

  const job = renderAndCache(ticket).finally(() => {
    if (pendingExports.get(key) === job) pendingExports.delete(key);
  });
  pendingExports.set(key, job);
  return job;
}
