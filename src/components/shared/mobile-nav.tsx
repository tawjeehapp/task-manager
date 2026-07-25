"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { mobileNavItems } from "@/components/shared/nav-config";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={t("menu")}
    >
      <ul className="grid grid-cols-4">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const label = t(item.key);
          const isActive = item.enabled && pathname === item.href;

          if (!item.enabled) {
            return (
              <li key={item.key}>
                <span
                  className="flex cursor-not-allowed flex-col items-center gap-1 px-2 py-2 text-[11px] text-muted-foreground/70"
                  aria-disabled="true"
                >
                  <Icon className="size-5" />
                  <span className="truncate">{label}</span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 px-2 py-2 text-[11px] text-muted-foreground transition-colors",
                  isActive && "font-medium text-primary",
                )}
              >
                <Icon
                  className={cn("size-5", isActive && "text-primary")}
                />
                <span className="truncate">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
