import { useLocalSearchParams } from "expo-router";

import { NativeTicketRoute } from "@/features/ticket/native-ticket-route";

export default function TicketRoute() {
  const { r } = useLocalSearchParams<{ r?: string | string[] }>();
  return <NativeTicketRoute revisionParam={r} />;
}
