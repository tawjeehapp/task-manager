"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Placeholder notification bell for the app shell.
 * Real notification center arrives after authentication (Milestone 1+).
 */
export function NotificationBell() {
  const t = useTranslations("notifications");
  const tHeader = useTranslations("header");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tHeader("notifications")}
          />
        }
      >
        <Bell className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>{t("title")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-3 text-sm text-muted-foreground">
          <p>{t("empty")}</p>
          <p className="mt-1 text-xs">{t("comingSoon")}</p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
