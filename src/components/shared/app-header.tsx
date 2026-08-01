"use client";

import { LogOut, Menu, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { AppSidebar } from "@/components/shared/app-sidebar";
import { BrandLockup } from "@/components/shared/brand-lockup";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { AuthMeResponse } from "@/features/auth/types/auth.types";
import { withInitialData } from "@/lib/query/initial-data";

type AppHeaderProps = {
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

export function AppHeader({ initialMe }: AppHeaderProps) {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tHeader = useTranslations("header");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: fetchMe,
    staleTime: 60_000,
    ...withInitialData(initialMe),
  });

  const displayName =
    meQuery.data?.user.fullName ?? tHeader("userPlaceholder");

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await queryClient.clear();
      router.replace("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border bg-card px-4">
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("menu")}
              />
            }
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>{tApp("name")}</SheetTitle>
            </SheetHeader>
            <AppSidebar
              className="border-0"
              initialMe={initialMe}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="min-w-0 flex-1">
        <BrandLockup size="sm" tone="onLight" />
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2"
                aria-label={displayName}
              />
            }
          >
            <User className="size-4" />
            <span className="hidden max-w-40 truncate sm:inline">
              {displayName}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem
              disabled={loggingOut}
              onClick={() => void handleLogout()}
            >
              <LogOut className="size-4" />
              {tHeader("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
