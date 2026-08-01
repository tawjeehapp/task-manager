"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { mobileNavItems } from "@/components/shared/nav-config";
import type { AuthMeResponse } from "@/features/auth/types/auth.types";
import { isPersonalWorkspaceRole } from "@/lib/permissions";
import type { Role } from "@/lib/permissions";
import { withInitialData } from "@/lib/query/initial-data";
import { cn } from "@/lib/utils";

type MobileNavProps = {
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

export function MobileNav({ initialMe }: MobileNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    ...withInitialData(initialMe),
  });
  const role = (meQuery.data?.user.role ?? null) as Role | null;
  const useMyTasksLabel = isPersonalWorkspaceRole(role);
  const isManager = role === "department_manager";
  const isAdmin = role === "admin";

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label={t("menu")}
    >
      <ul className="grid grid-cols-3">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const labelKey =
            item.key === "dashboard" && isManager
              ? "departmentDashboard"
              : item.key === "dashboard" && isAdmin
                ? "dashboard"
                : useMyTasksLabel && item.key === "tasks"
                  ? "myTasks"
                  : isAdmin && item.key === "tasks"
                    ? "orgTasks"
                    : item.key;
          const label = t(labelKey);
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
