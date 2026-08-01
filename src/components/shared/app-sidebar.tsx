"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import {
  navItemIsVisible,
  navSections,
} from "@/components/shared/nav-config";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AuthMeResponse } from "@/features/auth/types/auth.types";
import { isPersonalWorkspaceRole } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { withInitialData } from "@/lib/query/initial-data";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  className?: string;
  onNavigate?: () => void;
  initialMe: AuthMeResponse;
};

async function fetchMe(): Promise<AuthMeResponse | null> {
  const response = await fetch("/api/auth/me");
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { data?: AuthMeResponse };
  return payload.data ?? null;
}

export function AppSidebar({
  className,
  onNavigate,
  initialMe,
}: AppSidebarProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    ...withInitialData(initialMe),
  });

  const permissions = meQuery.data?.permissions ?? [];
  const role = (meQuery.data?.user.role ?? null) as Role | null;

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
            const visibleItems = section.items.filter((item) =>
              navItemIsVisible(item, permissions, role),
            );

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
                    const labelKey =
                      isPersonalWorkspaceRole(role) && item.key === "projects"
                        ? "myDepartmentAndProjects"
                        : isPersonalWorkspaceRole(role) && item.key === "tasks"
                          ? "myTasks"
                          : item.key;
                    const label = t(labelKey);
                    // Prefer exact match; avoid `/tasks` matching `/tasks/team`.
                    const isActive =
                      item.enabled &&
                      (pathname === item.href ||
                        (item.href !== "/" &&
                          item.href !== "/tasks" &&
                          pathname.startsWith(`${item.href}/`)));

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
