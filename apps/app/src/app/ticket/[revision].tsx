import { useLocalSearchParams } from "expo-router";

import { NativeTicketRoute } from "@/features/ticket/native-ticket-route";

export default function ArchivedTicketRoute() {
  const { revision } = useLocalSearchParams<{
    revision?: string | string[];
  }>();
  return <NativeTicketRoute revisionParam={revision} />;
}
