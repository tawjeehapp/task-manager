"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Notification } from "@/features/notifications/types/notification.types";
import { notificationHref } from "@/features/notifications/lib/notification-href";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ListResult = {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

export function NotificationsPageClient() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const listQuery = useQuery({
    queryKey: ["notifications", "list", page, pageSize, unreadOnly],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (unreadOnly) params.set("unreadOnly", "true");
      return fetch(`/api/notifications?${params}`).then((res) =>
        readApi<ListResult>(res),
      );
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/notifications/${id}/read`, { method: "POST" }).then((res) =>
        readApi(res),
      ),
    onSuccess: async () => {
      setSuccessMessage(t("markReadSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
      setSuccessMessage(null);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      fetch("/api/notifications/read-all", { method: "POST" }).then((res) =>
        readApi(res),
      ),
    onSuccess: async () => {
      setSuccessMessage(t("markAllSuccess"));
      setActionError(null);
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
      setSuccessMessage(null);
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={unreadOnly ? "default" : "outline"}
              onClick={() => {
                setUnreadOnly((value) => !value);
                setPage(1);
              }}
            >
              {unreadOnly ? t("all") : t("unreadOnly")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={markAllMutation.isPending}
              onClick={() => markAllMutation.mutate()}
            >
              {t("markAllRead")}
            </Button>
          </div>
        }
      />

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {listQuery.isLoading ? <LoadingState /> : null}
      {listQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={
            listQuery.error instanceof Error
              ? listQuery.error.message
              : tCommon("unexpectedError")
          }
          onRetry={() => void listQuery.refetch()}
        />
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      ) : null}

      {!listQuery.isLoading && !listQuery.isError && items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colType")}</TableHead>
                  <TableHead>{t("colTitle")}</TableHead>
                  <TableHead>{t("colMessage")}</TableHead>
                  <TableHead>{t("colTime")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const href = notificationHref(
                    item.entityType,
                    item.entityId,
                  );
                  return (
                    <TableRow
                      key={item.id}
                      className={!item.readAt ? "bg-primary/5" : undefined}
                    >
                      <TableCell>
                        <Badge variant="secondary">
                          {t(`type_${item.type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{item.title}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {item.message}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatDateTime(item.createdAt)}
                      </TableCell>
                      <TableCell>
                        {item.readAt ? t("statusRead") : t("statusUnread")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {!item.readAt ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={markReadMutation.isPending}
                              onClick={() => markReadMutation.mutate(item.id)}
                            >
                              {t("markRead")}
                            </Button>
                          ) : null}
                          {href ? (
                            <Link
                              href={href}
                              className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                            >
                              {t("open")}
                            </Link>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
