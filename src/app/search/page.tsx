import type { Metadata } from "next";
import { PlanWorkspace } from "@/features/plan/plan-workspace";

export const metadata: Metadata = { title: "곡 찾기" };

export default function SearchPage() {
  return <PlanWorkspace view="search" />;
}
