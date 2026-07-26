"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Loader2,
} from "lucide-react";

import type { EmployeeDashboard } from "@/features/dashboard/types/dashboard.types";
import { EmployeeTaskCalendar } from "@/features/dashboard/components/employee-task-calendar";
import { EmployeeAttendanceWidget } from "@/features/dashboard/components/employee-attendance-widget";
import { formatDate } from "@/lib/dates";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmployeeDashboardClientProps = {
  data: EmployeeDashboard;
  viewerId: string;
  viewerName: string;
};

function MetricCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
  tone?: "default" | "success" | "danger" | "info";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : tone === "info"
          ? "text-sky-600"
          : "text-amber-600";

  return (
    <Card size="sm" className="h-full">
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
}

export function EmployeeDashboardClient({
  data,
  viewerId,
  viewerName,
}: EmployeeDashboardClientProps) {
  const t = useTranslations("dashboard");

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("status_pending"),
      approved: t("status_approved"),
      rejected: t("status_rejected"),
      todo: t("status_todo"),
      in_progress: t("status_in_progress"),
      blocked: t("status_blocked"),
      completed: t("status_completed"),
    };
    return map[status] ?? status;
  };

  const subtitle =
    data.metrics.dueToday === 0
      ? t("greetingQuiet")
      : t("greetingDueToday", { count: data.metrics.dueToday });

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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={t("metricInProgress")}
          value={data.metrics.inProgress}
          icon={<Loader2 className="size-5" />}
          tone="default"
        />
        <MetricCard
          label={t("metricCompleted")}
          value={data.metrics.completed}
          icon={<CheckCircle2 className="size-5" />}
          tone="success"
        />
        <MetricCard
          label={t("metricOverdue")}
          value={data.metrics.overdue}
          icon={<AlertTriangle className="size-5" />}
          tone="danger"
        />
        <MetricCard
          label={t("metricWeekHours")}
          value={data.metrics.weekHours}
          icon={<Clock3 className="size-5" />}
          tone="info"
        />
      </div>

      <EmployeeTaskCalendar
        viewerId={viewerId}
        today={data.today}
        initialTodayTasks={data.todayTasks}
      />

      <EmployeeAttendanceWidget
        weekAttendance={data.weekAttendance}
        weekHours={data.metrics.weekHours}
      />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <CardTitle>{t("myRequests")}</CardTitle>
          <Link
            href="/leave"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
          >
            {t("viewLeave")}
          </Link>
        </CardHeader>
        <CardContent>
          {data.myRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noRequests")}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.myRequests.map((item) => (
                <li key={`${item.kind}-${item.id}`}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 truncate">
                      <span className="text-muted-foreground">
                        {t(`requestKind_${item.kind}`)} ·{" "}
                      </span>
                      <span className="font-medium">{item.title}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {statusLabel(item.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
