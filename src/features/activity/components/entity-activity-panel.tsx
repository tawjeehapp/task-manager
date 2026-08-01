"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { EntityActivityLog } from "@/features/activity/types/activity.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";

type EntityActivityPanelProps = {
  entityType: "project" | "department";
  entityId: string;
  /** Translation namespace that owns activity* keys. */
  messagesNamespace: "projects" | "departments";
};

type ActivityListResult = {
  items: EntityActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ACTION_LABEL_KEYS: Record<string, string> = {
  "project.created": "activityAction_created",
  "project.updated": "activityAction_updated",
  "project.member_added": "activityAction_member_added",
  "project.member_removed": "activityAction_member_removed",
  "department.updated": "activityAction_updated",
  "department.member_added": "activityAction_member_added",
  "department.member_removed": "activityAction_member_removed",
};

async function fetchActivity(
  entityType: "project" | "department",
  entityId: string,
  page: number,
  pageSize: number,
): Promise<ActivityListResult> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const base =
    entityType === "project"
      ? `/api/projects/${entityId}/activity`
      : `/api/departments/${entityId}/activity`;
  const response = await fetch(`${base}?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: ActivityListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

function formatMetadata(
  action: string,
  metadata: Record<string, unknown> | null,
  strings: {
    fieldsChange: (fields: string) => string;
    memberName: (name: string) => string;
  },
): string {
  if (!metadata) return "";

  if (
    (action === "project.updated" || action === "department.updated") &&
    Array.isArray(metadata.fields)
  ) {
    return strings.fieldsChange((metadata.fields as string[]).join(", "));
  }

  if (
    action === "project.member_added" ||
    action === "project.member_removed" ||
    action === "department.member_added" ||
    action === "department.member_removed"
  ) {
    const name = String(metadata.fullName ?? metadata.userId ?? "");
    return name ? strings.memberName(name) : "";
  }

  return "";
}

export function EntityActivityPanel({
  entityType,
  entityId,
  messagesNamespace,
}: EntityActivityPanelProps) {
  const t = useTranslations(messagesNamespace);
  const tCommon = useTranslations("common");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(
    DEFAULT_TABLE_PAGE_SIZE,
  );

  const activityQuery = useQuery({
    queryKey: [entityType, entityId, "activity", page, pageSize],
    queryFn: () => fetchActivity(entityType, entityId, page, pageSize),
  });

  if (activityQuery.isLoading) {
    return <LoadingState />;
  }

  if (activityQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(activityQuery.error as Error).message}
        onRetry={() => void activityQuery.refetch()}
      />
    );
  }

  const result = activityQuery.data!;
  const items = result.items;

  function actionLabel(action: string) {
    const key = ACTION_LABEL_KEYS[action];
    if (!key) return action;
    return t(key as "activityAction_updated");
  }

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <EmptyState
          title={t("activityEmptyTitle")}
          description={t("activityEmptyDescription")}
        />
      ) : (
        <ul className="divide-border divide-y rounded-lg border bg-card">
          {items.map((item) => {
            const detail = formatMetadata(item.action, item.metadata, {
              fieldsChange: (fields) => t("activityFieldsChange", { fields }),
              memberName: (name) => t("activityMemberName", { name }),
            });
            return (
              <li key={item.id} className="space-y-1 px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {actionLabel(item.action)}
                  </p>
                  <time className="text-muted-foreground text-xs tabular-nums">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="text-muted-foreground text-xs">
                  {item.user?.fullName ?? "—"}
                  {detail ? ` — ${detail}` : ""}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {result.total > 0 ? (
        <TablePagination
          page={result.page}
          pageSize={pageSize}
          total={result.total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      ) : null}
    </div>
  );
}
