import Link from "next/link";

export default function NotFound() {
  return (
    <section
      className="page-shell narrow-shell state-strip state-strip-missing"
      aria-labelledby="not-found-title"
    >
      <header className="state-strip-header">
        <p className="eyebrow">티켓 없음</p>
        <h1 id="not-found-title">이 티켓을 찾을 수 없어요.</h1>
      </header>
      <p className="lede state-strip-copy">
        주소가 다르거나, 링크가 만료되었거나, 보낸 사람이 공유를 끝냈을 수 있습니다. 보낸 사람에게
        새 티켓을 부탁해 주세요.
      </p>
      <div className="state-strip-actions">
        <Link className="button" href="/">
          내 세션으로 가기
        </Link>
      </div>
    </section>
  );
}
