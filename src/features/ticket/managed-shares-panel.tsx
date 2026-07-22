"use client";

import { useEffect, useRef, useState } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import Link from "next/link";
import {
  deleteManagedShare,
  getManagedShare,
  listManagedShares,
  type ManagedShareSummary,
} from "@/data/plan-database";

type ManagedSharesPanelProps = {
  refreshKey: number;
  onRevoked: (fingerprint: string) => void;
};

export function ManagedSharesPanel({ refreshKey, onRevoked }: ManagedSharesPanelProps) {
  const [shares, setShares] = useState<ManagedShareSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyFingerprint, setBusyFingerprint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    const sequence = ++loadSequence.current;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled || sequence !== loadSequence.current) return;
      setLoading(true);
      try {
        const next = await listManagedShares();
        if (cancelled || sequence !== loadSequence.current) return;
        setShares(next);
        setStatus(null);
      } catch {
        if (cancelled || sequence !== loadSequence.current) return;
        setStatus("이 브라우저의 공유 목록을 읽지 못했습니다. 저장 공간 권한을 확인해 주세요.");
      } finally {
        if (!cancelled && sequence === loadSequence.current) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function revokeShare(share: ManagedShareSummary) {
    if (busyFingerprint || !share.slug) return;
    setBusyFingerprint(share.fingerprint);
    setStatus(null);
    try {
      const capability = await getManagedShare(share.fingerprint);
      if (!capability) {
        setStatus(
          "이 브라우저에 철회 키가 없어 링크를 폐기할 수 없습니다. 링크는 표시된 만료 시각까지 유지됩니다.",
        );
        return;
      }
      const response = await fetch(`/api/shares/${share.slug}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${capability.revokeToken}`,
          "Content-Type": "application/json",
        },
        body: "{}",
        cache: "no-store",
      });
      if (!response.ok && response.status !== 404) {
        setStatus(
          response.status === 429
            ? "폐기 요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요."
            : "링크를 폐기하지 못했습니다. 로컬 철회 키는 그대로 보관했습니다.",
        );
        return;
      }
      await deleteManagedShare(share.fingerprint);
      setShares((current) =>
        current.filter(({ fingerprint }) => fingerprint !== share.fingerprint),
      );
      onRevoked(share.fingerprint);
      setStatus(
        response.status === 404
          ? "이미 만료되었거나 폐기된 링크를 로컬 목록에서 정리했습니다."
          : "공유 링크를 폐기하고 이 브라우저의 공유 기록과 철회 키를 함께 삭제했습니다.",
      );
    } catch {
      setStatus("네트워크 오류로 링크를 폐기하지 못했습니다. 연결 후 다시 시도해 주세요.");
    } finally {
      setBusyFingerprint(null);
    }
  }

  return (
    <section
      id="managed-shares"
      className="share-receipt managed-shares"
      aria-labelledby="managed-shares-title"
      aria-busy={loading}
    >
      <p className="eyebrow">이 기기의 공유 기록</p>
      <h2 id="managed-shares-title">공유 링크 관리</h2>
      <p className="managed-shares-intro">
        이 목록과 철회 키는 이 브라우저에만 있습니다. 브라우저 저장 공간을 지우면 남아 있는 링크를
        직접 철회할 수 없습니다.
      </p>
      {loading ? (
        <p role="status">공유 목록을 확인하는 중…</p>
      ) : shares.length === 0 ? (
        <div className="managed-share-empty">
          <p>이 브라우저에서 관리 중인 공유 링크가 없습니다.</p>
          <Link href="/">세션 티켓 만들기</Link>
        </div>
      ) : (
        <ul className="managed-shares-list">
          {shares.map((share) => (
            <li className="managed-share-row" key={share.fingerprint}>
              <div className="managed-share-copy">
                {share.slug ? (
                  <a href={`/s/${share.slug}`} rel="nofollow noreferrer">
                    티켓 {share.slug.slice(0, 6)}… 열기
                  </a>
                ) : (
                  <strong>주소 정보가 없는 티켓</strong>
                )}
                <p className="managed-share-meta">
                  만료:{" "}
                  {share.expiresAt ? (
                    <time dateTime={share.expiresAt}>
                      {new Date(share.expiresAt).toLocaleString("ko-KR")}
                    </time>
                  ) : (
                    "확인할 수 없음"
                  )}
                </p>
              </div>
              {share.canRevoke ? (
                <AlertDialog.Root>
                  <AlertDialog.Trigger
                    className="button-danger"
                    disabled={busyFingerprint !== null}
                  >
                    {busyFingerprint === share.fingerprint ? "폐기 중…" : "링크 폐기"}
                  </AlertDialog.Trigger>
                  <AlertDialog.Portal>
                    <AlertDialog.Backdrop className="dialog-backdrop" />
                    <AlertDialog.Viewport className="dialog-viewport">
                      <AlertDialog.Popup className="dialog-popup">
                        <AlertDialog.Title>이 공유 링크를 폐기할까요?</AlertDialog.Title>
                        <AlertDialog.Description>
                          주소를 받은 사람도 더 이상 티켓을 열 수 없습니다. 이 브라우저의 철회 키도
                          함께 삭제되며, 이 작업은 되돌릴 수 없습니다.
                        </AlertDialog.Description>
                        <div className="button-row">
                          <AlertDialog.Close className="button-secondary">취소</AlertDialog.Close>
                          <button
                            className="button-danger"
                            type="button"
                            onClick={() => void revokeShare(share)}
                            disabled={busyFingerprint !== null}
                            aria-busy={busyFingerprint === share.fingerprint}
                          >
                            {busyFingerprint === share.fingerprint ? "링크 폐기 중…" : "링크 폐기"}
                          </button>
                        </div>
                      </AlertDialog.Popup>
                    </AlertDialog.Viewport>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              ) : (
                <p className="managed-share-unavailable">
                  철회 키가 없어 이 브라우저에서 폐기할 수 없습니다.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="ticket-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
