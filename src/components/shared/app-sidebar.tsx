"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { navSections } from "@/components/shared/nav-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
};

type MeResponse = {
  user: { fullName: string };
  permissions: string[];
};

async function fetchMe(): Promise<MeResponse | null> {
  const response = await fetch("/api/auth/me");
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { data?: MeResponse };
  return payload.data ?? null;
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60_000,
  });

  const permissions = meQuery.data?.permissions ?? [];

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <ScrollArea className="flex-1 px-3 py-5">
        <nav className="space-y-7">
          {navSections.map((section) => {
            const visibleItems = section.items.filter((item) => {
              if (!item.enabled) {
                return true;
              }
              if (!item.permission) {
                return true;
              }
              return permissions.includes(item.permission);
            });

            if (visibleItems.length === 0) {
              return null;
            }

            return (
              <div key={section.key} className="space-y-2">
                <p className="px-3 text-sm font-semibold text-sidebar-primary">
                  {t(section.key)}
                </p>
                <ul className="space-y-1.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const label = t(item.key);
                    const isActive = item.enabled && pathname === item.href;

                    if (!item.enabled) {
                      return (
                        <li key={item.key}>
                          <span
                            className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-base text-sidebar-foreground/45"
                            aria-disabled="true"
                          >
                            <Icon className="size-5 shrink-0" />
                            <span className="truncate">{label}</span>
                          </span>
                        </li>
                      );
                    }

                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-base font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            isActive &&
                              "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-primary/50",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-5 shrink-0",
                              isActive
                                ? "text-sidebar-primary"
                                : "text-sidebar-foreground",
                            )}
                          />
                          <span className="truncate">{label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
