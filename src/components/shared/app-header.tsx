"use client";

import { Menu, User } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { AppSidebar } from "@/components/shared/app-sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function AppHeader() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const tHeader = useTranslations("header");
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
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
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold lg:hidden">{tApp("name")}</p>
        <p className="hidden truncate text-sm text-muted-foreground lg:block">
          {tApp("name")}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <NotificationBell />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-2"
          disabled
          aria-label={tHeader("userPlaceholder")}
        >
          <User className="size-4" />
          <span className="hidden sm:inline">{tHeader("userPlaceholder")}</span>
        </Button>
      </div>
    </header>
  );
}
