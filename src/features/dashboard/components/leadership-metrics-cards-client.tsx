"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Ban,
  CheckCircle2,
  Circle,
  Clock3,
  FolderKanban,
  Loader2,
} from "lucide-react";

import {
  MetricTasksDialog,
  type MetricTasksQuery,
} from "@/features/dashboard/components/employee-metric-dialogs";
import type {
  LeadershipMetrics,
  LeadershipStatusTiming,
} from "@/features/dashboard/types/dashboard.types";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LeadershipMetricsCardsClientProps = {
  today: string;
  metrics: LeadershipMetrics;
};

type OpenStatus = TaskStatus | null;

function StatusTimingFooter({
  timing,
  overdueLabel,
  dueTodayLabel,
}: {
  timing: LeadershipStatusTiming;
  overdueLabel: string;
  dueTodayLabel: string;
}) {
  const parts: ReactNode[] = [];
  if (timing.overdue > 0) {
    parts.push(
      <span key="overdue" className="text-destructive tabular-nums">
        {timing.overdue} {overdueLabel}
      </span>,
    );
  }
  if (timing.dueToday > 0) {
    parts.push(
      <span key="dueToday" className="tabular-nums text-amber-700">
        {timing.dueToday} {dueTodayLabel}
      </span>,
    );
  }
  if (parts.length === 0) return null;

  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-snug text-muted-foreground">
      {parts.map((part, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          {index > 0 ? <span aria-hidden>·</span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}

function MetricCard({
  label,
  value,
  icon,
  iconClassName,
  onClick,
  footer,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  iconClassName?: string;
  onClick?: () => void;
  footer?: ReactNode;
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        "h-full",
        onClick &&
          "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
        <div className="min-w-0 space-y-1">
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
            {value}
          </CardTitle>
          {footer}
        </div>
        <span className={cn("mt-1 shrink-0", iconClassName)}>{icon}</span>
      </CardHeader>
    </Card>
  );

  if (!onClick) return card;

  return (
    <button type="button" onClick={onClick} className="h-full w-full text-start">
      {card}
    </button>
  );
}

export function LeadershipMetricsCardsClient({
  today,
  metrics,
}: LeadershipMetricsCardsClientProps) {
  const t = useTranslations("dashboard");
  const [openStatus, setOpenStatus] = useState<OpenStatus>(null);

  const statusQuery: MetricTasksQuery | null = openStatus
    ? { status: openStatus }
    : null;

  const statusTitle = openStatus
    ? t("metricTasksModalTitle", {
        status:
          openStatus === "todo"
            ? t("metricTodo")
            : openStatus === "in_progress"
              ? t("metricInProgress")
              : openStatus === "blocked"
                ? t("metricBlocked")
                : t("metricCompleted"),
      })
    : "";

  return (
    <>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label={t("metricTodo")}
          value={metrics.todoCount}
          icon={<Circle className="size-5" />}
          iconClassName="text-muted-foreground"
          onClick={() => setOpenStatus("todo")}
          footer={
            <StatusTimingFooter
              timing={metrics.todoTiming}
              overdueLabel={t("metricSubOverdue")}
              dueTodayLabel={t("metricSubDueToday")}
            />
          }
        />
        <MetricCard
          label={t("metricInProgress")}
          value={metrics.inProgressCount}
          icon={<Loader2 className="size-5" />}
          iconClassName="text-amber-600"
          onClick={() => setOpenStatus("in_progress")}
          footer={
            <StatusTimingFooter
              timing={metrics.inProgressTiming}
              overdueLabel={t("metricSubOverdue")}
              dueTodayLabel={t("metricSubDueToday")}
            />
          }
        />
        <MetricCard
          label={t("metricBlocked")}
          value={metrics.blockedCount}
          icon={<Ban className="size-5" />}
          iconClassName="text-destructive"
          onClick={() => setOpenStatus("blocked")}
          footer={
            <StatusTimingFooter
              timing={metrics.blockedTiming}
              overdueLabel={t("metricSubOverdue")}
              dueTodayLabel={t("metricSubDueToday")}
            />
          }
        />
        <MetricCard
          label={t("metricCompleted")}
          value={metrics.completedCount}
          icon={<CheckCircle2 className="size-5" />}
          iconClassName="text-emerald-600"
          onClick={() => setOpenStatus("completed")}
          footer={
            <StatusTimingFooter
              timing={metrics.completedTiming}
              overdueLabel={t("metricSubOverdue")}
              dueTodayLabel={t("metricSubDueToday")}
            />
          }
        />
        <MetricCard
          label={t("metricTeamWeekHours")}
          value={metrics.weekHours}
          icon={<Clock3 className="size-5" />}
          iconClassName="text-sky-600"
          footer={
            <div className="space-y-0.5 text-[11px] leading-snug text-muted-foreground">
              {metrics.weekHoursApproved > 0 ? (
                <p>
                  <span className="text-emerald-700 tabular-nums">
                    {metrics.weekHoursApproved}
                  </span>{" "}
                  {t("metricHoursApproved")}
                </p>
              ) : null}
              {metrics.weekHoursPending > 0 ? (
                <p>
                  <span className="text-amber-700 tabular-nums">
                    {metrics.weekHoursPending}
                  </span>{" "}
                  {t("metricHoursPending")}
                </p>
              ) : null}
              {metrics.weekHoursRejected > 0 ? (
                <p>
                  <span className="text-destructive tabular-nums">
                    {metrics.weekHoursRejected}
                  </span>{" "}
                  {t("metricHoursRejected")}
                </p>
              ) : null}
            </div>
          }
        />
        <MetricCard
          label={t("metricProjects")}
          value={metrics.activeProjectsCount}
          icon={<FolderKanban className="size-5" />}
          iconClassName="text-violet-600"
          footer={
            <p className="text-[11px] leading-snug text-muted-foreground">
              {t("metricAvgProgress", {
                percent: Math.round(metrics.avgProgressPercent),
              })}
            </p>
          }
        />
      </div>

      <MetricTasksDialog
        open={openStatus != null}
        onOpenChange={(open) => {
          if (!open) setOpenStatus(null);
        }}
        title={statusTitle}
        today={today}
        query={statusQuery}
      />
    </>
  );
}
