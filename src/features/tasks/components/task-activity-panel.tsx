"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { TaskActivityLog } from "@/features/tasks/types/task.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";

type TaskActivityPanelProps = {
  taskId: string;
};

type ActivityListResult = {
  items: TaskActivityLog[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

async function fetchActivity(
  taskId: string,
  page: number,
  pageSize: number,
): Promise<ActivityListResult> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  const response = await fetch(
    `/api/tasks/${taskId}/activity?${params.toString()}`,
  );
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
  statusLabel: (status: string) => string,
  strings: {
    statusChange: (from: string, to: string) => string;
    assignedChange: string;
  },
): string {
  if (!metadata) {
    return "";
  }

  if (action === "task.status_changed") {
    const from = String(metadata.from ?? "");
    const to = String(metadata.to ?? "");
    return strings.statusChange(
      from ? statusLabel(from) : "—",
      to ? statusLabel(to) : "—",
    );
  }

  if (action === "task.assigned") {
    return strings.assignedChange;
  }

  if (action === "task.dependency_added") {
    return String(metadata.dependsOnTitle ?? metadata.dependsOnTaskId ?? "");
  }

  if (action === "task.updated" && Array.isArray(metadata.fields)) {
    return (metadata.fields as string[]).join(", ");
  }

  return "";
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  "task.created": "activityAction_task_created",
  "task.assigned": "activityAction_task_assigned",
  "task.status_changed": "activityAction_task_status_changed",
  "task.updated": "activityAction_task_updated",
  "task.dependency_added": "activityAction_task_dependency_added",
  "task.dependency_removed": "activityAction_task_dependency_removed",
};

export function TaskActivityPanel({ taskId }: TaskActivityPanelProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(
    DEFAULT_TABLE_PAGE_SIZE,
  );

  const activityQuery = useQuery({
    queryKey: ["tasks", taskId, "activity", page, pageSize],
    queryFn: () => fetchActivity(taskId, page, pageSize),
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

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  function actionLabel(action: string) {
    const key = ACTION_LABEL_KEYS[action];
    if (!key) {
      return action;
    }
    return t(key as "activityAction_task_created");
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState
          title={t("activityEmptyTitle")}
          description={t("activityEmptyDescription")}
        />
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {items.map((item) => {
            const detail = formatMetadata(item.action, item.metadata, statusLabel, {
              statusChange: (from, to) =>
                t("activityStatusChange", { from, to }),
              assignedChange: t("activityAssignedChange"),
            });
            return (
              <li key={item.id} className="space-y-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {actionLabel(item.action)}
                  </p>
                  <time className="text-muted-foreground text-xs tabular-nums">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                <p className="text-muted-foreground text-sm">
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
