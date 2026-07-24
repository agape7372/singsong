"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { clearLocalDataForTests, clearProfilePhoto, saveProfile } from "@/data/plan-database";
import { PROFILE_COLORS, ProfileAvatar } from "@/features/profile/profile-avatar";
import { useProfile } from "@/features/profile/use-profile";

const NICKNAME_MAX = 12;

export function SettingsScreen() {
  const profile = useProfile();
  const [nickname, setNickname] = useState(profile.nickname);
  const [status, setStatus] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const nicknameDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useRef(false);

  // Adopt the stored nickname once it first loads, but never clobber live typing.
  useEffect(() => {
    if (!hydrated.current && profile.nickname) {
      setNickname(profile.nickname);
      hydrated.current = true;
    }
  }, [profile.nickname]);

  useEffect(() => {
    return () => {
      if (nicknameDebounce.current) clearTimeout(nicknameDebounce.current);
    };
  }, []);

  function onNicknameChange(value: string) {
    const next = value.slice(0, NICKNAME_MAX);
    setNickname(next);
    hydrated.current = true;
    if (nicknameDebounce.current) clearTimeout(nicknameDebounce.current);
    nicknameDebounce.current = setTimeout(() => {
      void saveProfile({ nickname: next.trim() });
    }, 400);
  }

  async function onColorPick(colorId: string) {
    await saveProfile({ colorId });
  }

  async function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await saveProfile({ photo: file });
      setStatus("프로필 사진을 이 기기에 저장했습니다.");
    } catch {
      setStatus("사진을 저장하지 못했습니다. 저장 공간 권한을 확인해 주세요.");
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function onRemovePhoto() {
    await clearProfilePhoto();
    setStatus("프로필 사진을 지웠습니다.");
  }

  async function onClearData() {
    setClearing(true);
    try {
      await clearLocalDataForTests();
      window.location.assign("/");
    } catch {
      setClearing(false);
      setStatus("데이터를 지우지 못했습니다. 잠시 뒤 다시 시도해 주세요.");
    }
  }

  return (
    <section
      className="page-shell task-shell narrow-shell settings-shell"
      aria-labelledby="settings-title"
    >
      <header className="settings-header">
        <p className="eyebrow">이 기기</p>
        <h1 id="settings-title">설정</h1>
      </header>

      <div className="settings-sheet">
        <section className="settings-group" aria-labelledby="settings-profile-title">
          <h2 id="settings-profile-title">프로필</h2>
          <p className="settings-note">
            닉네임과 사진은 이 기기에만 저장되며, 공유 링크나 티켓 이미지에는 포함되지 않습니다.
          </p>
          <div className="profile-editor">
            <ProfileAvatar profile={profile} size={64} className="profile-editor-avatar" />
            <div className="profile-editor-fields">
              <label className="field-label" htmlFor="profile-nickname">
                닉네임
              </label>
              <input
                id="profile-nickname"
                className="input"
                type="text"
                value={nickname}
                maxLength={NICKNAME_MAX}
                placeholder="예: 지민"
                onChange={(event) => onNicknameChange(event.target.value)}
              />
            </div>
          </div>

          <fieldset className="profile-colors">
            <legend className="field-label">색상</legend>
            <div className="profile-color-swatches" role="radiogroup" aria-label="프로필 색상">
              {PROFILE_COLORS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  role="radio"
                  aria-checked={profile.colorId === color.id}
                  aria-label={color.label}
                  className="profile-color-swatch"
                  data-selected={profile.colorId === color.id}
                  style={{ background: color.chip }}
                  onClick={() => void onColorPick(color.id)}
                />
              ))}
            </div>
          </fieldset>

          <div className="profile-photo-actions">
            <input
              ref={photoInputRef}
              id="profile-photo"
              className="sr-only"
              type="file"
              accept="image/*"
              onChange={(event) => void onPhotoChange(event)}
            />
            <label className="button-secondary" htmlFor="profile-photo">
              사진 추가
            </label>
            {profile.photo && (
              <button className="button-link" type="button" onClick={() => void onRemovePhoto()}>
                사진 제거
              </button>
            )}
          </div>
        </section>

        <section className="settings-group" aria-labelledby="settings-install-title">
          <h2 id="settings-install-title">설치</h2>
          <p className="settings-note">
            홈 화면에 추가하면 브라우저 탭 없이 앱처럼 열 수 있어요. 임시 미리보기 주소는 영구
            서비스가 아니며, 주소가 바뀌면 이 기기의 플랜이 자동으로 옮겨지지 않습니다.
          </p>
          <ul className="settings-steps">
            <li>
              <strong>iPhone Safari</strong> — 공유 → 홈 화면에 추가 → ‘웹 앱으로 열기’ 활성화 →
              추가
            </li>
            <li>
              <strong>Android Chrome</strong> — 더보기 → 홈 화면에 추가 → 설치
            </li>
          </ul>
        </section>

        <section className="settings-group" aria-labelledby="settings-data-title">
          <h2 id="settings-data-title">데이터</h2>
          <p className="settings-note">
            플랜·발권 기록·프로필은 이 기기의 브라우저에 자동 저장됩니다. 서버로 전송되지 않으며,
            브라우저 저장 공간을 지우면 함께 사라집니다.
          </p>
          <p className="settings-row">
            <Link className="button-link" href="/import#storage-status">
              저장소 상태 도움말
            </Link>
          </p>
          <AlertDialog.Root>
            <AlertDialog.Trigger className="button-danger" disabled={clearing}>
              이 기기 데이터 지우기
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Backdrop className="dialog-backdrop" />
              <AlertDialog.Viewport className="dialog-viewport">
                <AlertDialog.Popup className="dialog-popup">
                  <AlertDialog.Title>이 기기 데이터를 모두 지울까요?</AlertDialog.Title>
                  <AlertDialog.Description>
                    현재 플랜, 발권 기록, 가져온 플랜, 공유 철회 키, 프로필이 모두 삭제됩니다. 이
                    작업은 되돌릴 수 없습니다.
                  </AlertDialog.Description>
                  <div className="button-row">
                    <AlertDialog.Close className="button-secondary">취소</AlertDialog.Close>
                    <button
                      className="button-danger"
                      type="button"
                      onClick={() => void onClearData()}
                      disabled={clearing}
                      aria-busy={clearing}
                    >
                      {clearing ? "지우는 중…" : "모두 지우기"}
                    </button>
                  </div>
                </AlertDialog.Popup>
              </AlertDialog.Viewport>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </section>

        <section className="settings-group" aria-labelledby="settings-info-title">
          <h2 id="settings-info-title">정보</h2>
          <p className="settings-note">
            싱송(작업명)은 로컬 우선 노래방 세션 플래너입니다. 곡·계산·발권 데이터는 이 기기에만
            머무릅니다.
          </p>
        </section>
      </div>

      <p className="settings-status" role="status" aria-live="polite">
        {status}
      </p>
    </section>
  );
}
