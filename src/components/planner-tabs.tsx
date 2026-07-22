"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  {
    href: "/",
    label: "플랜",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 4.5h12v15H6z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    ),
  },
  {
    href: "/search",
    label: "검색",
    icon: (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="10.5" cy="10.5" r="5.5" />
        <path d="m15 15 4.5 4.5" />
      </svg>
    ),
  },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();
  if (pathname !== "/" && pathname !== "/search") return null;

  return (
    <nav className="primary-nav" aria-label="주요 화면">
      {destinations.map(({ href, label, icon }) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          <span className="primary-nav-icon">{icon}</span>
          <span className="primary-nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  );
}
