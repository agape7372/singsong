/* eslint-disable @next/next/no-html-link-for-pages -- The wordmark must not retain the broader ticket document CSP. */
import { PrimaryNav } from "./planner-tabs";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="wordmark" href="/" aria-label="싱송 플랜 홈">
          <span aria-hidden="true" className="wordmark-cut">
            S
          </span>
          <span className="wordmark-copy">
            <strong>싱송</strong>
            <small aria-hidden="true">SingSong</small>
          </span>
        </a>
        <PrimaryNav />
        <div className="app-header-actions" data-app-header-actions />
        <p className="header-status">
          <span className="status-dot" aria-hidden="true" />
          <span>이 기기에 자동 저장</span>
        </p>
      </div>
    </header>
  );
}
