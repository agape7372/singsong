import type { Metadata } from "next";
import { Suspense } from "react";
import { ImportScreen } from "@/features/import/import-screen";

export const metadata: Metadata = {
  title: "티켓 가져오기",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function ImportPage() {
  return (
    <Suspense
      fallback={<section className="page-shell narrow-shell">가져오기 화면을 준비하는 중…</section>}
    >
      <ImportScreen />
    </Suspense>
  );
}
