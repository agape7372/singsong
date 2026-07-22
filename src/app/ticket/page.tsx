import type { Metadata } from "next";
import { TicketScreen } from "@/features/ticket/ticket-screen";

export const metadata: Metadata = { title: "발급된 세션 티켓" };

export default function TicketPage() {
  return <TicketScreen />;
}
