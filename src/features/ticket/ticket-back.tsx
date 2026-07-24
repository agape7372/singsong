import type { SharedSnapshot } from "@/domain/models";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function range(low: number, high: number) {
  return low === high ? won.format(low) : `${won.format(low)}–${won.format(high)}`;
}

/** Back face of a session ticket: the full song ledger and calculation detail
 *  that the summary front deliberately omits. Data comes from the same payload. */
export function TicketBack({
  payload,
  headingLevel,
  className = "",
}: {
  payload: SharedSnapshot;
  headingLevel: "h1" | "h2" | "h3";
  className?: string;
}) {
  const { calculation, items } = payload;
  const Heading = headingLevel;
  const lowMinutes = Math.floor(calculation.duration.lowSec / 300) * 5;
  const highMinutes = Math.ceil(calculation.duration.highSec / 300) * 5;
  const pricingLabel = calculation.pricing.kind === "song" ? "곡당 요금" : "시간 요금";

  return (
    <section className={`ticket-card ticket-back ${className}`.trim()} aria-label="티켓 뒷면 상세">
      <header className="ticket-back-header">
        <p className="ticket-kicker">뒷면 · 상세</p>
        <Heading className="ticket-back-title">전체 곡 순서</Heading>
      </header>
      <ol className="ticket-back-list" aria-label={`전체 ${items.length}곡`}>
        {items.map((item) => (
          <li key={item.order}>
            <span className="ticket-back-index" aria-hidden="true">
              {String(item.order + 1).padStart(2, "0")}
            </span>
            <div className="ticket-back-copy">
              <strong>{item.title}</strong>
              <small>{item.artist || "가수 미입력"}</small>
            </div>
            <small className="ticket-back-code">
              {item.karaokeCodes.map(({ vendor, code }) => `${vendor} ${code}`).join(" · ") ||
                "직접 입력"}
            </small>
          </li>
        ))}
      </ol>
      <section className="ticket-back-detail" aria-label="계산 상세">
        <dl className="ticket-back-summary">
          <div>
            <dt>예상 시간</dt>
            <dd>
              {lowMinutes}–{highMinutes}분
            </dd>
          </div>
          <div>
            <dt>총 비용</dt>
            <dd>{range(calculation.derived.totalLowWon, calculation.derived.totalHighWon)}</dd>
          </div>
          <div>
            <dt>인원</dt>
            <dd>{calculation.people}명</dd>
          </div>
          <div>
            <dt>1인당</dt>
            <dd>
              {range(calculation.derived.perPersonLowWon, calculation.derived.perPersonHighWon)}
            </dd>
          </div>
          <div>
            <dt>과금 방식</dt>
            <dd>{pricingLabel}</dd>
          </div>
        </dl>
        <p className="ticket-assumption">평균 곡 길이 기준 · 원 단위 올림 · 대기 시간 제외</p>
      </section>
    </section>
  );
}
