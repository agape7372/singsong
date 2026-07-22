import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { headers } from "next/headers";
import { getShareRepository } from "@/features/share/repository.server";
import { TicketCard } from "@/features/ticket/ticket-card";
import { getRuntimeProfile } from "@/server/runtime-profile";
import { ShareHandoffActions } from "@/features/share/share-handoff-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SLUG = /^[A-Za-z0-9_-]{21}[AQgw]$/u;

const readShare = cache(async (slug: string) => {
  if (!SLUG.test(slug)) return null;
  return getShareRepository().get(slug);
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await readShare(slug);
  const title = share ? `${share.payload.calculation.songCount}곡 세션 티켓` : "공유 세션 티켓";
  const description = share
    ? "함께 부를 순서와 예상 시간·비용을 확인하세요."
    : "공유 티켓을 열 수 없습니다.";
  const image = {
    url: `/api/og/${encodeURIComponent(slug)}`,
    width: 1_200,
    height: 630,
    alt: share ? "싱송 공유 세션 티켓 요약" : "싱송 공유 티켓을 열 수 없음",
  };

  return {
    title,
    description,
    robots: { index: false, follow: false, nocache: true },
    referrer: "no-referrer",
    openGraph: {
      type: "website",
      title,
      description,
      url: `/s/${encodeURIComponent(slug)}`,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function SharedTicketPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const share = await readShare(slug);
  if (!share) notFound();
  const userAgent = (await headers()).get("user-agent") ?? "";
  const inAppHint = /KAKAOTALK|Instagram|FBAN|FBAV|Line\//iu.test(userAgent);

  return (
    <section className="page-shell shared-ticket-shell" aria-labelledby="shared-ticket-heading">
      <header className="shared-ticket-heading">
        <div>
          <p className="eyebrow">받은 티켓 · READ ONLY</p>
          <h1 id="shared-ticket-heading">함께 부를 세션이 도착했어요.</h1>
        </div>
        <p>만료 {new Date(share.expiresAt).toLocaleDateString("ko-KR")}</p>
      </header>
      <div className="shared-ticket-body">
        <TicketCard
          payload={share.payload}
          fingerprint={share.fingerprint}
          testData={getRuntimeProfile() === "fixture"}
          headingLevel="h2"
        />
        <div className="shared-detail-column">
          <section className="shared-ledger" aria-labelledby="shared-ledger-heading">
            <p className="step-label">
              전체 순서{" "}
              <span className="serial-meta" aria-hidden="true">
                FULL LEDGER · {share.payload.items.length} TRACKS
              </span>
            </p>
            <h3 id="shared-ledger-heading">전체 곡 순서</h3>
            <ol>
              {share.payload.items.map((item, index) => (
                <li key={`${item.order}-${item.title}-${item.artist}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.artist || "가수 미입력"}</small>
                  </div>
                  <small>
                    {item.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ") ||
                      "직접 입력"}
                  </small>
                </li>
              ))}
            </ol>
          </section>
          <aside className="handoff-panel" aria-labelledby="handoff-heading">
            <div>
              <h3 id="handoff-heading">내 순서로 이어서 편집할까요?</h3>
              <p>
                가져오기는 저장을 실행한 브라우저의 활성 플랜을 바꿉니다. 자동 동기화나 공동편집은
                시작되지 않아요.
              </p>
            </div>
            <ShareHandoffActions slug={slug} inAppHint={inAppHint} />
          </aside>
          <p className="privacy-note">
            이 주소는 검색 목록에 공개되지 않지만, 주소를 아는 사람은 만료 전까지 볼 수 있습니다.
          </p>
        </div>
      </div>
    </section>
  );
}
