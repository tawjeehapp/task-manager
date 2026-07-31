"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Ban,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
} from "lucide-react";

import type { EmployeeDashboard } from "@/features/dashboard/types/dashboard.types";
import type { TaskStatus } from "@/features/tasks/types/task.types";
import { EmployeeTaskCalendar } from "@/features/dashboard/components/employee-task-calendar";
import { EmployeeAttendanceWidget } from "@/features/dashboard/components/employee-attendance-widget";
import {
  EmployeeStatusTasksDialog,
  EmployeeWeekHoursDialog,
} from "@/features/dashboard/components/employee-metric-dialogs";
import { formatDate } from "@/lib/dates";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmployeeDashboardClientProps = {
  data: EmployeeDashboard;
  viewerId: string;
  viewerName: string;
};

type MetricTone = "default" | "success" | "danger" | "info" | "muted";

type OpenMetric = TaskStatus | "hours" | null;

function MetricCard({
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: MetricTone;
  onClick?: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : tone === "info"
          ? "text-sky-600"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-amber-600";

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
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
            {value}
          </CardTitle>
        </div>
        <span className={cn("mt-1", toneClass)}>{icon}</span>
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

export function EmployeeDashboardClient({
  data,
  viewerId,
  viewerName,
}: EmployeeDashboardClientProps) {
  const t = useTranslations("dashboard");
  const [openMetric, setOpenMetric] = useState<OpenMetric>(null);

  const subtitle = t("greetingSummary", {
    dueToday: data.metrics.dueToday,
    overdue: data.metrics.overdue,
  });

  const statusDialogOpen =
    openMetric === "todo" ||
    openMetric === "in_progress" ||
    openMetric === "blocked" ||
    openMetric === "completed";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          {formatDate(data.today, "dddd D MMMM")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("greetingHello", { name: viewerName })}
        </h1>
        <p className="text-muted-foreground">{subtitle}</p>
      </div>

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label={t("metricTodo")}
          value={data.metrics.todo}
          icon={<Circle className="size-5" />}
          tone="muted"
          onClick={() => setOpenMetric("todo")}
        />
        <MetricCard
          label={t("metricInProgress")}
          value={data.metrics.inProgress}
          icon={<Loader2 className="size-5" />}
          tone="default"
          onClick={() => setOpenMetric("in_progress")}
        />
        <MetricCard
          label={t("metricBlocked")}
          value={data.metrics.blocked}
          icon={<Ban className="size-5" />}
          tone="danger"
          onClick={() => setOpenMetric("blocked")}
        />
        <MetricCard
          label={t("metricCompleted")}
          value={data.metrics.completed}
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
          onClick={() => setOpenMetric("completed")}
        />
        <MetricCard
          label={t("metricWeekHours")}
          value={data.metrics.weekHours}
          icon={<Clock3 className="size-5" />}
          tone="info"
          onClick={() => setOpenMetric("hours")}
        />
      </div>

      <EmployeeTaskCalendar
        viewerId={viewerId}
        today={data.today}
        initialTodayTasks={data.todayTasks}
      />

      <EmployeeAttendanceWidget
        viewerId={viewerId}
        weekAttendance={data.weekAttendance}
        weekHours={data.metrics.weekHours}
      />

      {statusDialogOpen ? (
        <EmployeeStatusTasksDialog
          open={statusDialogOpen}
          onOpenChange={(open) => {
            if (!open) setOpenMetric(null);
          }}
          viewerId={viewerId}
          status={openMetric as TaskStatus}
          today={data.today}
        />
      ) : null}

      <EmployeeWeekHoursDialog
        open={openMetric === "hours"}
        onOpenChange={(open) => {
          if (!open) setOpenMetric(null);
        }}
        weekAttendance={data.weekAttendance}
        weekHours={data.metrics.weekHours}
      />
    </div>
  );
}
