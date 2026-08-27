"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import VersionFooter from "@/components/VersionFooter";

const NAV_LINKS: {
  label: string;
  href: string;
  match: (pathname: string) => boolean;
}[] = [
  {
    label: "Contacts",
    href: "/contacts",
    match: (path) => path.startsWith("/contacts") && path !== "/contacts/new",
  },
  {
    label: "New contact",
    href: "/contacts/new",
    match: (path) => path === "/contacts/new",
  },
];

function Wordmark() {
  return (
    <span className="font-display text-base font-bold leading-none tracking-tight text-foreground">
      SF<span className="text-primary">Contacts</span>
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // `trailingSlash: true` means the live pathname is "/contacts/", so normalise
  // before matching rather than comparing the raw string.
  const currentPath = pathname.replace(/\/+$/, "") || "/";

  return (
    <div className="flex min-h-screen flex-col">
      {/* Floating glass island instead of a full-width bar: the nav hovers
          over the page with a soft blur, so content reads edge to edge. */}
      <header className="sticky top-0 z-40 px-4 pt-3">
        <div className="mx-auto flex h-12 max-w-5xl items-center gap-8 rounded-2xl border border-hairline/70 bg-card/70 px-5 shadow-lg shadow-black/10 backdrop-blur-xl">
          <Link href="/contacts" className="flex items-center gap-2">
            <Wordmark />
          </Link>

          <nav className="flex items-center gap-5 text-sm">
            {NAV_LINKS.map((link) => {
              const active = link.match(currentPath);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative py-1 transition-colors after:absolute after:inset-x-0 after:-bottom-0.5 after:h-px after:origin-left after:rounded-full after:bg-primary motion-safe:after:transition-transform motion-safe:after:duration-200 ${
                    active
                      ? "text-foreground after:scale-x-100"
                      : "text-muted-foreground after:scale-x-0 hover:text-foreground hover:after:scale-x-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <VersionFooter />
    </div>
  );
}
