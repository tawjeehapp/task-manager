"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { ProjectGanttResult } from "@/features/gantt/types/gantt.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { Input } from "@/components/ui/input";

type ProjectGanttClientProps = {
  projectId: string;
  projectName?: string;
};

const DAY_PX = 28;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 220;

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime();
  const b = new Date(`${to}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function fetchGantt(
  projectId: string,
  filters: {
    status?: string;
    assignee?: string;
    dueFrom?: string;
    dueTo?: string;
  },
): Promise<ProjectGanttResult> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.dueFrom) params.set("dueFrom", filters.dueFrom);
  if (filters.dueTo) params.set("dueTo", filters.dueTo);
  const qs = params.toString();
  const response = await fetch(
    `/api/projects/${projectId}/gantt${qs ? `?${qs}` : ""}`,
  );
  const payload = (await response.json()) as {
    data?: ProjectGanttResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

export function ProjectGanttClient({
  projectId,
  projectName,
}: ProjectGanttClientProps) {
  const t = useTranslations("gantt");
  const tTasks = useTranslations("tasks");
  const tProjects = useTranslations("projects");
  const tCommon = useTranslations("common");
  const [statusFilter, setStatusFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");

  const ganttQuery = useQuery({
    queryKey: ["projects", projectId, "gantt", statusFilter, dueFrom, dueTo],
    queryFn: () =>
      fetchGantt(projectId, {
        status: statusFilter || undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
      }),
  });

  const orderedTasks = useMemo(() => {
    return ganttQuery.data?.tasks ?? [];
  }, [ganttQuery.data?.tasks]);

  const chart = useMemo(() => {
    if (!ganttQuery.data) {
      return null;
    }
    const { rangeStart, rangeEnd, dependencies } = ganttQuery.data;
    const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
    const width = totalDays * DAY_PX;
    const height = Math.max(orderedTasks.length * ROW_HEIGHT, ROW_HEIGHT);

    const dayTicks: string[] = [];
    for (let i = 0; i < totalDays; i += 1) {
      dayTicks.push(addDays(rangeStart, i));
    }

    const barRects = orderedTasks.map((task, index) => {
      const offset = daysBetween(rangeStart, task.barStart);
      const duration = Math.max(1, daysBetween(task.barStart, task.barEnd) + 1);
      return {
        task,
        index,
        x: offset * DAY_PX,
        y: index * ROW_HEIGHT + 8,
        width: duration * DAY_PX,
        height: ROW_HEIGHT - 16,
      };
    });

    const barById = new Map(barRects.map((bar) => [bar.task.id, bar]));
    const lines = dependencies
      .map((dep) => {
        const from = barById.get(dep.dependsOnTaskId);
        const to = barById.get(dep.taskId);
        if (!from || !to) return null;
        return {
          id: `${dep.dependsOnTaskId}-${dep.taskId}`,
          x1: from.x + from.width,
          y1: from.y + from.height / 2,
          x2: to.x,
          y2: to.y + to.height / 2,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }>;

    return { width, height, dayTicks, barRects, lines, totalDays };
  }, [ganttQuery.data, orderedTasks]);

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { label: tProjects("title"), href: "/projects" },
            {
              label: projectName ?? tProjects("detailsTitle"),
              href: `/projects/${projectId}`,
            },
            { label: t("title") },
          ]}
        />
        <PageHeader title={t("title")} description={t("description")} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">{tTasks("filterAllStatuses")}</option>
          {(
            ["todo", "in_progress", "blocked", "completed"] as const
          ).map((status) => (
            <option key={status} value={status}>
              {tTasks(`status_${status}`)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {tTasks("dueFrom")}
          </span>
          <Input
            type="date"
            className="h-9 w-auto"
            value={dueFrom}
            onChange={(event) => setDueFrom(event.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {tTasks("dueTo")}
          </span>
          <Input
            type="date"
            className="h-9 w-auto"
            value={dueTo}
            onChange={(event) => setDueTo(event.target.value)}
          />
        </label>
      </div>

      {ganttQuery.isLoading ? <LoadingState /> : null}
      {ganttQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={(ganttQuery.error as Error).message}
          onRetry={() => void ganttQuery.refetch()}
        />
      ) : null}

      {ganttQuery.isSuccess && orderedTasks.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : null}

      {ganttQuery.isSuccess && chart && orderedTasks.length > 0 ? (
        <div className="border-border overflow-x-auto rounded-lg border">
          <div className="flex min-w-max">
            <div
              className="border-border bg-background sticky start-0 z-10 border-e"
              style={{ width: LABEL_WIDTH }}
            >
              <div className="text-muted-foreground border-border flex h-10 items-center border-b px-3 text-xs font-medium">
                {t("taskColumn")}
              </div>
              {orderedTasks.map((task) => (
                <div
                  key={task.id}
                  className="border-border flex items-center border-b px-3 text-sm"
                  style={{ height: ROW_HEIGHT }}
                >
                  <Link
                    href={`/tasks/${task.id}`}
                    className="truncate font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                </div>
              ))}
            </div>

            <div className="relative">
              <div
                className="border-border relative h-10 border-b"
                style={{ width: chart.width }}
              >
                {chart.dayTicks.map((day, index) =>
                  index % 3 === 0 ? (
                    <div
                      key={day}
                      className="text-muted-foreground absolute top-0 flex h-10 items-end pb-1 text-[10px] tabular-nums"
                      style={{ insetInlineStart: index * DAY_PX }}
                    >
                      {day.slice(5)}
                    </div>
                  ) : null,
                )}
              </div>

              <div
                className="relative"
                style={{ width: chart.width, height: chart.height }}
              >
                <svg
                  className="pointer-events-none absolute inset-0"
                  width={chart.width}
                  height={chart.height}
                  aria-hidden
                >
                  {chart.lines.map((line) => (
                    <path
                      key={line.id}
                      d={`M ${line.x1} ${line.y1} C ${(line.x1 + line.x2) / 2} ${line.y1}, ${(line.x1 + line.x2) / 2} ${line.y2}, ${line.x2} ${line.y2}`}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity={0.35}
                      strokeWidth={1.5}
                    />
                  ))}
                </svg>

                {chart.barRects.map((bar) => (
                  <Link
                    key={bar.task.id}
                    href={`/tasks/${bar.task.id}`}
                    className={`absolute rounded-md px-2 text-[11px] leading-[28px] text-white ${
                      bar.task.overdue
                        ? "bg-destructive"
                        : bar.task.status === "completed"
                          ? "bg-emerald-600"
                          : "bg-primary"
                    }`}
                    style={{
                      insetInlineStart: bar.x,
                      top: bar.y,
                      width: bar.width,
                      height: bar.height,
                    }}
                    title={`${bar.task.title} · ${bar.task.barStart} → ${bar.task.barEnd}${bar.task.overdue ? ` · ${t("overdue")}` : ""}`}
                  >
                    <span className="relative z-10 truncate">
                      {bar.task.progressPercentage > 0
                        ? `${bar.task.progressPercentage}%`
                        : ""}
                    </span>
                    {bar.task.progressPercentage > 0 ? (
                      <span
                        className="absolute inset-y-0 inset-inline-start-0 rounded-md bg-black/20"
                        style={{
                          width: `${Math.min(100, bar.task.progressPercentage)}%`,
                        }}
                      />
                    ) : null}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
