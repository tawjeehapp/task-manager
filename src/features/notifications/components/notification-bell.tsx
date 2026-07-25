"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import type { Notification } from "@/features/notifications/types/notification.types";
import { notificationHref } from "@/features/notifications/lib/notification-href";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ListResult = {
  items: Notification[];
  total: number;
};

type UnreadResult = { count: number };

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

export function NotificationBell() {
  const t = useTranslations("notifications");
  const tHeader = useTranslations("header");
  const queryClient = useQueryClient();

  const unreadQuery = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () =>
      fetch("/api/notifications/unread-count").then((res) =>
        readApi<UnreadResult>(res),
      ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const listQuery = useQuery({
    queryKey: ["notifications", "bell"],
    queryFn: () =>
      fetch("/api/notifications?page=1&pageSize=25").then((res) =>
        readApi<ListResult>(res),
      ),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}/read`, { method: "POST" }).then((res) =>
        readApi<Notification>(res),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const unreadCount = unreadQuery.data?.count ?? 0;
  const items = (listQuery.data?.items ?? []).slice(0, 8);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tHeader("notifications")}
            className="relative"
          />
        }
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute end-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>{t("title")}</span>
            {unreadCount > 0 ? (
              <span className="text-xs font-normal text-muted-foreground">
                {t("unreadBadge", { count: unreadCount })}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <div className="px-2 py-3 text-sm text-muted-foreground">
            <p>{t("empty")}</p>
          </div>
        ) : (
          <ul className="max-h-80 overflow-y-auto">
            {items.map((item) => {
              const href = notificationHref(item.entityType, item.entityId);
              const unread = !item.readAt;
              return (
                <li key={item.id} className="border-b border-border last:border-0">
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 px-3 py-2 text-start text-sm hover:bg-muted/60 ${
                      unread ? "bg-primary/5" : ""
                    }`}
                    onClick={() => {
                      if (unread) {
                        markReadMutation.mutate(item.id);
                      }
                      if (href) {
                        window.location.href = href;
                      }
                    }}
                  >
                    <span className="font-medium text-foreground">
                      {item.title}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">
                      {item.message}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5">
          <Link
            href="/notifications"
            className="flex h-7 w-full items-center justify-center rounded-lg text-[0.8rem] font-medium hover:bg-muted"
          >
            {t("viewAll")}
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
