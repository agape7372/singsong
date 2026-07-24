"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_PATHS = ["/", "/library", "/discover", "/settings"] as const;

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
    href: "/library",
    label: "보관함",
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
        <path d="M5 5h14v14H5z" />
        <path d="M5 9h14" />
        <path d="M10 14h4" />
      </svg>
    ),
  },
  {
    href: "/discover",
    label: "발견",
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
        <circle cx="12" cy="12" r="8" />
        <path d="m15 9-3.5 1.5L10 15l3.5-1.5z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "설정",
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
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3.5v2.5M12 18v2.5M20.5 12H18M6 12H3.5M17.7 6.3l-1.8 1.8M8.1 15.9l-1.8 1.8M17.7 17.7l-1.8-1.8M8.1 8.1 6.3 6.3" />
      </svg>
    ),
  },
] as const;

export function PrimaryNav() {
  const pathname = usePathname();
  if (!(NAV_PATHS as readonly string[]).includes(pathname)) return null;

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
