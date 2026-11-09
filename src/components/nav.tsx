"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountStatus } from "./account-status";

const links = [
  { href: "/", label: "Overview", icon: "M3 12l9-8 9 8M5 10v10h14V10" },
  { href: "/budget", label: "Budget", icon: "M4 7h16v12H4zM4 7l2-3h12l2 3M15 13h2" },
  { href: "/debts", label: "Debts", icon: "M3 6h18v12H3zM3 10h18M7 15h4" },
  { href: "/plan", label: "Plan", icon: "M3 20l6-9 4 5 8-12M21 4v5M21 4h-5" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Bottom tab bar on phones, sidebar from tablet width up. */
export function Nav() {
  const pathname = usePathname();

  return (
    <>
      <header className="flex items-center justify-between gap-4 px-4 pt-5 md:hidden">
        <Link href="/" className="font-display text-lg font-bold tracking-tight text-indigo">
          Utang Tracker
        </Link>
        <AccountStatus compact />
      </header>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:static md:w-56 md:shrink-0 md:border-t-0 md:border-r md:px-5 md:py-10"
      >
        <Link
          href="/"
          className="hidden font-display text-xl font-bold tracking-tight text-indigo md:block"
        >
          Utang Tracker
        </Link>
        <ul className="grid grid-cols-4 md:mt-10 md:flex md:flex-col md:gap-0.5">
          {links.map(({ href, label, icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-1 py-2.5 text-xs md:flex-row md:gap-3 md:rounded-md md:px-3 md:py-2 md:text-sm ${
                    active
                      ? "font-semibold text-indigo md:bg-indigo-soft"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={icon} />
                  </svg>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-10 hidden border-t border-line pt-5 md:block">
          <AccountStatus />
        </div>
      </nav>
    </>
  );
}
