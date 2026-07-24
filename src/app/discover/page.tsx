import type { Metadata } from "next";
import { DiscoverScreen } from "@/features/discover/discover-screen";

export const metadata: Metadata = { title: "발견" };

export default function DiscoverPage() {
  return <DiscoverScreen />;
}
