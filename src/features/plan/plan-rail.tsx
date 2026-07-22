import Link from "next/link";
import { calculateCostRange, estimateDuration, roundDurationOutward } from "@/domain/calculation";
import type { Plan } from "@/domain/models";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

function formatWonRange(lowWon: number, highWon: number) {
  const low = won.format(lowWon);
  return lowWon === highWon ? low : `${low}–${won.format(highWon)}`;
}

export function PlanRail({ plan }: { plan: Plan }) {
  const songCount = plan.items.length;
  const duration = songCount > 0 ? roundDurationOutward(estimateDuration(songCount)) : null;
  const cost = songCount > 0 && plan.pricing ? calculateCostRange(songCount, plan.pricing) : null;

  return (
    <aside className="plan-rail" aria-label="현재 플랜 요약">
      <dl className="plan-rail-summary">
        <div>
          <dt>현재 플랜</dt>
          <dd>{songCount}곡</dd>
        </div>
        <div>
          <dt>예상 시간</dt>
          <dd>{duration ? `약 ${duration.lowMinutes}–${duration.highMinutes}분` : "계산 전"}</dd>
        </div>
        <div>
          <dt>예상 비용</dt>
          <dd>{cost ? formatWonRange(cost.lowWon, cost.highWon) : "요금 미입력"}</dd>
        </div>
      </dl>
      <Link className="button plan-rail-action" href="/">
        플랜 보기
      </Link>
    </aside>
  );
}
