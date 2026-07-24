"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogTrack } from "@/features/catalog/types";
import { addCatalogTracks } from "@/features/plan/add-tracks";
import { FIXTURE_PLAYLISTS, playlistTracks, type FixturePlaylist } from "./fixture-playlists";

function describeResult(added: number, dup: number, full: number) {
  if (added === 0 && dup > 0) return "이미 플랜에 담긴 곡이에요.";
  if (added === 0 && full > 0) return "플랜이 가득 차 더 담을 수 없어요.";
  if (added === 0) return "담을 곡이 없어요.";
  const tail = full > 0 ? " (100곡을 넘겨 일부는 제외)" : dup > 0 ? " (중복 제외)" : "";
  return `${added}곡을 플랜에 담았어요.${tail}`;
}

function PlaylistCard({
  playlist,
  busy,
  onAdd,
}: {
  playlist: FixturePlaylist;
  busy: boolean;
  onAdd: (tracks: CatalogTrack[]) => void;
}) {
  const tracks = playlistTracks(playlist);
  const preview = tracks.slice(0, 3);

  return (
    <article className="discover-playlist" aria-labelledby={`${playlist.id}-title`}>
      <header className="discover-playlist-head">
        <div>
          <h2 id={`${playlist.id}-title`}>{playlist.title}</h2>
          <p className="discover-playlist-blurb">{playlist.blurb}</p>
        </div>
        <span className="discover-playlist-count" aria-label={`${tracks.length}곡`}>
          {tracks.length}곡
        </span>
      </header>
      <ul className="discover-preview">
        {preview.map((track, index) => (
          <li key={track.id}>
            <span className="discover-preview-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="discover-preview-copy">
              <strong>{track.title}</strong>
              <span>{track.artist}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="discover-playlist-actions">
        <button className="button" type="button" disabled={busy} onClick={() => onAdd(tracks)}>
          플레이리스트 담기
        </button>
        <details className="discover-songs">
          <summary>곡 전체 보기</summary>
          <ul className="discover-song-list">
            {tracks.map((track, index) => (
              <li key={track.id}>
                <span className="discover-preview-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="discover-preview-copy">
                  <strong>{track.title}</strong>
                  <span>{track.artist}</span>
                </span>
                <button
                  className="button-link"
                  type="button"
                  disabled={busy}
                  onClick={() => onAdd([track])}
                >
                  담기
                </button>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </article>
  );
}

export function DiscoverScreen() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleAdd(tracks: CatalogTrack[]) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await addCatalogTracks(tracks);
      setStatus(describeResult(result.added, result.skippedDuplicate, result.skippedFull));
    } catch {
      setStatus("플랜에 담지 못했어요. 저장 공간 권한을 확인해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="page-shell task-shell narrow-shell discover-shell"
      aria-labelledby="discover-title"
    >
      <header className="discover-header">
        <p className="eyebrow">
          가상 큐레이션 <span className="test-data-tag">TEST DATA</span>
        </p>
        <h1 id="discover-title">발견</h1>
        <p className="discover-lede">
          권리 확보 전 미리 보는 가상 플레이리스트예요. 실제 셀럽·차트가 아니라 테스트 곡으로
          구성했어요.
        </p>
      </header>

      <div className="discover-playlists">
        {FIXTURE_PLAYLISTS.map((playlist) => (
          <PlaylistCard key={playlist.id} playlist={playlist} busy={busy} onAdd={handleAdd} />
        ))}
      </div>

      <p className="discover-footer">
        마음에 드는 곡을 담고 <Link href="/">플랜에서 이어서</Link> 순서를 정리하세요.
      </p>

      <p className="discover-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
