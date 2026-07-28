/** @type {import('prettier').Config} */
const config = {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  // 저장소는 LF로 커밋되지만 Windows의 core.autocrlf=true 는 체크아웃 때 CRLF로 바꾼다.
  // 기본값("lf")이면 git checkout 직후 `prettier --check` 가 전 파일에서 실패해
  // verify 게이트가 막힌다. "auto" 는 작업 트리의 줄바꿈을 그대로 인정한다.
  endOfLine: "auto",
};

export default config;
