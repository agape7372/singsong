"use client";

import { Dialog } from "@base-ui/react/dialog";
import type { CatalogTrack } from "@/features/catalog/types";
import { SearchLedger, type ManualTrackInput } from "./search-ledger";

type SearchSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  onAdd: (track: CatalogTrack) => Promise<boolean> | boolean;
  onManualAdd: (input: ManualTrackInput) => Promise<boolean> | boolean;
  onUndoCatalogAdd: (catalogSongId: string) => Promise<boolean> | boolean;
  isManualDuplicate: (input: ManualTrackInput) => boolean;
  addedCatalogIds: ReadonlySet<string>;
  isFull: boolean;
};

export function SearchSheet({
  open,
  onOpenChange,
  count,
  onAdd,
  onManualAdd,
  onUndoCatalogAdd,
  isManualDuplicate,
  addedCatalogIds,
  isFull,
}: SearchSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="search-sheet-backdrop" />
        <Dialog.Viewport className="search-sheet-viewport">
          <Dialog.Popup className="search-sheet" aria-describedby={undefined}>
            <div className="search-sheet-grabber" aria-hidden="true" />
            <header className="search-sheet-header">
              <Dialog.Title className="search-sheet-title">곡 담기</Dialog.Title>
              <span className="search-sheet-count" aria-label={`현재 ${count}곡 담김`}>
                {count}곡 담김
              </span>
              <Dialog.Close className="search-sheet-close" aria-label="검색 닫기">
                <span aria-hidden="true">닫기</span>
              </Dialog.Close>
            </header>
            <div className="search-sheet-body">
              <SearchLedger
                onAdd={onAdd}
                onManualAdd={onManualAdd}
                onUndoCatalogAdd={onUndoCatalogAdd}
                isManualDuplicate={isManualDuplicate}
                addedCatalogIds={addedCatalogIds}
                isFull={isFull}
                autoFocus
              />
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
