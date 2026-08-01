"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { Notification } from "@/features/notifications/types/notification.types";
import { notificationHref } from "@/features/notifications/lib/notification-href";
import { useMarkSeenOnView } from "@/lib/hooks/use-mark-seen-on-view";
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
import { Badge } from "@/components/ui/badge";
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);

  const listQuery = useQuery({
    queryKey: ["notifications", "list", page, pageSize],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      return fetch(`/api/notifications?${params}`).then((res) =>
        readApi<ListResult>(res),
      );
    },
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const unreadIds = items.filter((item) => !item.readAt).map((item) => item.id);

  useMarkSeenOnView({
    enabled: listQuery.isSuccess,
    unreadIds,
    endpoint: "/api/notifications/mark-read",
    invalidateQueryKey: ["notifications"],
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} description={t("description")} />

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
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex h-7 items-center rounded-lg px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                          >
                            {t("open")}
                          </Link>
                        ) : null}
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
