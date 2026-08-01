"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Columns3, List } from "lucide-react";

import type { TaskSortBy } from "@/features/tasks/schemas/task.schema";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import { TasksListTable } from "@/features/tasks/components/tasks-list-table";
import { EmployeeTasksBoard } from "@/features/tasks/components/employee-tasks-board";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ProjectMemberOption = {
  userId: string;
  user?: { id: string; fullName: string };
};

type ProjectTasksPanelProps = {
  projectId: string;
  canEdit: boolean;
  viewerId: string;
  /** Reports the filtered total for the parent tab badge. */
  onTotalChange?: (total: number) => void;
};

const EMPTY_TASKS: TasksListResult = {
  items: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_TABLE_PAGE_SIZE,
  totalPages: 0,
};

async function fetchProjectTasks(params: {
  projectId: string;
  page: number;
  pageSize: TablePageSize;
  sortBy: TaskSortBy;
  sortDir: SortDirection;
  status?: string;
  assignee?: string;
  priority?: string;
  dueFrom?: string;
  dueTo?: string;
}): Promise<TasksListResult> {
  const searchParams = new URLSearchParams({
    projectId: params.projectId,
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.status) searchParams.set("status", params.status);
  if (params.assignee) searchParams.set("assignee", params.assignee);
  if (params.priority) searchParams.set("priority", params.priority);
  if (params.dueFrom) searchParams.set("dueFrom", params.dueFrom);
  if (params.dueTo) searchParams.set("dueTo", params.dueTo);

  const response = await fetch(`/api/tasks?${searchParams.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchProjectMembers(
  projectId: string,
): Promise<ProjectMemberOption[]> {
  const response = await fetch(`/api/projects/${projectId}/members`);
  const payload = (await response.json()) as {
    data?: { items: ProjectMemberOption[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data?.items ?? [];
}

export function ProjectTasksPanel({
  projectId,
  canEdit,
  viewerId,
  onTotalChange,
}: ProjectTasksPanelProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [sortBy] = useState<TaskSortBy>("createdAt");
  const [sortDir] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [mineOnly, setMineOnly] = useState(false);

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      "project-list",
      projectId,
      page,
      pageSize,
      sortBy,
      sortDir,
      statusFilter,
      assigneeFilter,
      priorityFilter,
      dueFrom,
      dueTo,
      mineOnly,
    ],
    queryFn: () =>
      fetchProjectTasks({
        projectId,
        page,
        pageSize,
        sortBy,
        sortDir,
        status: statusFilter || undefined,
        assignee: mineOnly ? viewerId : assigneeFilter || undefined,
        priority: priorityFilter || undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
      }),
  });

  const membersQuery = useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => fetchProjectMembers(projectId),
    enabled: !mineOnly,
  });

  const items = tasksQuery.data?.items ?? [];
  const total = tasksQuery.data?.total ?? 0;

  useEffect(() => {
    if (tasksQuery.isSuccess) {
      onTotalChange?.(total);
    }
  }, [onTotalChange, tasksQuery.isSuccess, total]);

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-lg border border-border p-0.5"
          role="group"
          aria-label={t("viewMode")}
        >
          <Button
            type="button"
            size="sm"
            variant={viewMode === "list" ? "secondary" : "ghost"}
            className={cn("gap-1.5", viewMode === "list" && "shadow-sm")}
            onClick={() => setViewMode("list")}
          >
            <List className="size-3.5" />
            {t("listView")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "board" ? "secondary" : "ghost"}
            className={cn("gap-1.5", viewMode === "board" && "shadow-sm")}
            onClick={() => setViewMode("board")}
          >
            <Columns3 className="size-3.5" />
            {t("boardView")}
          </Button>
        </div>
      </div>

      {viewMode === "board" ? (
        <EmployeeTasksBoard
          viewerId={viewerId}
          initialTasks={EMPTY_TASKS}
          mode="project"
          projectId={projectId}
          hideHeader
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={mineOnly}
                onChange={(event) => {
                  setMineOnly(event.target.checked);
                  if (event.target.checked) {
                    setAssigneeFilter("");
                  }
                  setPage(1);
                }}
              />
              {t("mineOnly")}
            </label>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("filterAllStatuses")}</option>
              {(
                ["todo", "in_progress", "blocked", "completed"] as const
              ).map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
                </option>
              ))}
            </select>
            <select
              className="border-input bg-background h-9 rounded-md border px-3 text-sm"
              value={priorityFilter}
              onChange={(event) => {
                setPriorityFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">{t("filterAllPriorities")}</option>
              {(["low", "medium", "high"] as const).map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabel(priority)}
                </option>
              ))}
            </select>
            {!mineOnly ? (
              <select
                className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                value={assigneeFilter}
                onChange={(event) => {
                  setAssigneeFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("filterAllAssignees")}</option>
                {(membersQuery.data ?? []).map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.user?.fullName ?? member.userId}
                  </option>
                ))}
              </select>
            ) : null}
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">
                {t("dueFrom")}
              </span>
              <Input
                type="date"
                className="h-9 w-auto"
                value={dueFrom}
                onChange={(event) => {
                  setDueFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground whitespace-nowrap">
                {t("dueTo")}
              </span>
              <Input
                type="date"
                className="h-9 w-auto"
                value={dueTo}
                onChange={(event) => {
                  setDueTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>

          {tasksQuery.isLoading ? <LoadingState /> : null}
          {tasksQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(tasksQuery.error as Error).message}
              onRetry={() => void tasksQuery.refetch()}
            />
          ) : null}

          {tasksQuery.isSuccess && items.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          ) : null}

          {tasksQuery.isSuccess && items.length > 0 ? (
            <>
              <p className="text-muted-foreground text-sm">
                {t("totalCount", { count: total })}
              </p>
              <TasksListTable
                tasks={items}
                canEdit={canEdit}
                viewerId={viewerId}
              />
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
        </>
      )}
    </div>
  );
}
