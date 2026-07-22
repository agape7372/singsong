"use client";

import { AlertDialog } from "@base-ui/react/alert-dialog";

export function NewPlanDialog({
  count,
  isSaving,
  onConfirm,
  onOpenChange,
}: {
  count: number;
  isSaving: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <AlertDialog.Root open onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="dialog-backdrop" />
        <AlertDialog.Viewport className="dialog-viewport">
          <AlertDialog.Popup className="dialog-popup">
            <AlertDialog.Title>현재 플랜을 비우고 새로 시작할까요?</AlertDialog.Title>
            <AlertDialog.Description>
              현재 {count}곡과 계산 설정이 새 플랜으로 교체됩니다. 자동 보관은 하지 않지만, 교체
              직후에는 이 화면에서 한 번 되돌릴 수 있습니다. 오래 남겨야 한다면 먼저 PNG나 공유
              링크로 보관해 주세요.
            </AlertDialog.Description>
            <div className="button-row">
              <button className="button" type="button" disabled={isSaving} onClick={onConfirm}>
                새 플랜 시작
              </button>
              <AlertDialog.Close className="button-secondary">취소</AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
