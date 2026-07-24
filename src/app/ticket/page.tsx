import type { Metadata } from "next";
import { TicketScreen } from "@/features/ticket/ticket-screen";

export const metadata: Metadata = { title: "발급된 세션 티켓" };

export default async function TicketPage({
  searchParams,
}: {
  searchParams: Promise<{ r?: string }>;
}) {
  const { r } = await searchParams;
  const parsed = r === undefined ? Number.NaN : Number(r);
  const revision = Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
  return <TicketScreen revision={revision} />;
}
