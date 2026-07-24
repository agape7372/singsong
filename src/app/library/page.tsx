import type { Metadata } from "next";
import { LibraryScreen } from "@/features/library/library-screen";

export const metadata: Metadata = { title: "보관함" };

export default function LibraryPage() {
  return <LibraryScreen />;
}
