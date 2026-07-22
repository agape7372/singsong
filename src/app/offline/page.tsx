import Link from "next/link";

export const metadata = { title: "오프라인" };

export default function OfflinePage() {
  return (
    <section
      className="page-shell narrow-shell state-strip state-strip-offline"
      aria-labelledby="offline-title"
    >
      <header className="state-strip-header">
        <p className="eyebrow">오프라인</p>
        <h1 id="offline-title">연결이 없어도 세션은 남아 있어요.</h1>
      </header>
      <p className="lede state-strip-copy">
        저장된 곡 순서와 계산은 이 기기에서 계속 사용할 수 있습니다. 검색과 새 공유 링크 발급은
        인터넷 연결이 돌아온 뒤 다시 시도해 주세요.
      </p>
      <div className="state-strip-actions">
        <Link className="button" href="/">
          저장된 세션 열기
        </Link>
      </div>
    </section>
  );
}
