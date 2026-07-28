# OG font provenance

`NotoSansKR-700.subset.ttf` is a 19,772-byte, weight-700 static subset used only by the server-generated Open Graph image. It deliberately contains fixed SingSong UI copy, ASCII letters/numbers and required punctuation; it does not contain enough glyphs to render user-entered song titles or artist names.

- Source family: Noto Sans KR
- Source version: `Version 2.04;241114210130;non-release`
- Source file SHA-256: `018174E8CDD366AFF67C8D366C7DC806A7BABBE7F2819FC23B00D59F7B8353D0`
- Subset SHA-256: `0A57D35AD1302EC81AB90916365D6F6BCEAE610662302A508018D8E3373A492C`
- Generator: fonttools `4.61.1`; `wght=700` static instancing followed by glyph subsetting
- Mapped codepoints: 148
- License: SIL Open Font License 1.1; see `OFL.txt`
- Upstream license reference: <https://github.com/notofonts/noto-cjk/blob/main/Sans/LICENSE>

The font asset is already checked into the project; fonttools and the original system font are not runtime or build dependencies.

## 2026-07-26 재생성 이유

OG 이미지를 앱 티켓과 같은 한국어 표기로 통일하면서(`오늘의 세션 스트립`, `공유 시 30일 · 검색 비노출` 등) 이전 서브셋에 없던 글리프가 생겼다. 이전 서브셋은 옛 문구(`함께 부를 세션 티켓`, `UNLISTED · 30 DAYS`) 기준이라 `오늘의스트립공유일검색노출는` 이 빠져 있었고, 한글 시스템 폰트가 없는 리눅스 서버에서는 그 글자들이 깨진다.

재생성 명령(개발 기기에서 1회):

```
python -m fontTools.varLib.instancer <source>/NotoSansKR-VF.ttf wght=700 -o noto-700.ttf
python -m fontTools.subset noto-700.ttf --text-file=og-chars.txt \
  --output-file=NotoSansKR-700.subset.ttf --layout-features='' --no-hinting \
  --desubroutinize --name-IDs='*' --drop-tables+=DSIG
```

`og-chars.txt` 에는 OG가 렌더할 수 있는 **고정 문구만** 넣는다. 임의의 한글을 넣으면 사용자가 입력한 곡 제목이 렌더될 수 있게 되어, 이 서브셋이 지키던 프라이버시 성질이 깨진다.
