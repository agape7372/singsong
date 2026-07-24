# SingSong Space Concept Lab

티켓을 앱 전체의 배경으로 쓰지 않고, 약속을 만드는 동안에는 앱을 하나의 공간으로 느끼게 하는 인터랙티브 컨셉 10종이다.

## 실행

`index.html`을 브라우저에서 직접 열면 된다. 모든 CSS와 JavaScript는 이 폴더 안에 있으며 외부 네트워크나 빌드가 필요하지 않다.

## 인터랙션

- 상단 필터로 CUTLINE 2.0, Bold Editorial, Utility Ledger, Hybrid 계열을 비교한다.
- `크게 보기`로 한 컨셉에 집중한다.
- 각 데모에서 인원을 2–8명으로 조정한다.
- 곡을 추가·삭제하면 시간과 비용이 함께 바뀐다.
- `이 공간에서 약속 확정`을 누르면 처음으로 실제 티켓이 나타난다.

## 파일

- `index.html`: 디자인 랩 구조와 티켓 대화상자
- `styles.css`: 공통 UI와 10개 공간 컨셉
- `app.js`: 데이터 렌더링과 데모 인터랙션
- `capture.mjs`: Chromium 캡처 및 Axe·반응형 검증

## 검증

프로젝트 루트에서 다음 명령으로 검증할 수 있다.

```powershell
node design-lab/space-concepts/capture.mjs
```

캡처와 `validation.json`은 `C:/tmp/singsong-space-concepts/`에 생성된다.
