import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { DashboardSummary } from "@/features/dashboard/types/dashboard.types";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardPageViewProps = {
  data: DashboardSummary;
  canViewReports: boolean;
};

function MetricCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const content = (
    <Card size="sm" className="h-full">
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  );
  if (!href) return content;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {content}
    </Link>
  );
}

function ListCard({
  title,
  empty,
  children,
  action,
}: {
  title: string;
  empty: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  const hasChildren = Array.isArray(children)
    ? children.length > 0
    : Boolean(children);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {hasChildren ? (
          <ul className="divide-y divide-border">{children}</ul>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

export async function DashboardPageView({
  data,
  canViewReports,
}: DashboardPageViewProps) {
  const t = await getTranslations("dashboard");

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("status_pending"),
      approved: t("status_approved"),
      rejected: t("status_rejected"),
      todo: t("status_todo"),
      in_progress: t("status_in_progress"),
      blocked: t("status_blocked"),
      completed: t("status_completed"),
      draft: t("status_draft"),
      active: t("status_active"),
      archived: t("status_archived"),
    };
    return map[status] ?? status;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canViewReports ? (
            <Link
              href="/reports"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              {t("openReports")}
            </Link>
          ) : null
        }
      />

      {data.role === "admin" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("metricDepartments")}
              value={data.departmentsCount}
              href="/departments"
            />
            <MetricCard
              label={t("metricActiveProjects")}
              value={data.activeProjectsCount}
              href="/projects"
            />
            <MetricCard
              label={t("metricEmployees")}
              value={data.employeesCount}
              href="/employees"
            />
            <MetricCard
              label={t("metricPendingApprovals")}
              value={data.pendingApprovals.total}
              href="/approvals"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("metricPendingApprovals")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingLeave")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.leave}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingExtension")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.extension}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingExcusal")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.excusal}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingAttendance")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.attendance}
                    </span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/approvals"
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    {t("viewApprovals")}
                  </Link>
                  <Link
                    href="/attendance"
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    {t("viewAttendance")}
                  </Link>
                </div>
              </CardContent>
            </Card>

            <ListCard title={t("companyWorkload")} empty={t("noWorkload")}>
              {data.companyWorkload.map((item) => (
                <li key={item.userId}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {item.fullName}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("activeTasks", { count: item.activeTaskCount })} ·{" "}
                      {t("estimatedHours", { hours: item.estimatedHours })}
                    </span>
                  </Link>
                </li>
              ))}
            </ListCard>
          </div>
        </>
      ) : null}

      {data.role === "department_manager" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label={t("departmentProjects")}
              value={data.departmentProjects.length}
              href="/projects"
            />
            <MetricCard
              label={t("overdueTasks")}
              value={data.overdueTasks.length}
              href="/tasks"
            />
            <MetricCard
              label={t("metricPendingApprovals")}
              value={data.pendingApprovals.total}
              href="/approvals"
            />
            <MetricCard
              label={t("teamWorkload")}
              value={data.teamWorkload.length}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ListCard title={t("departmentProjects")} empty={t("noProjects")}>
              {data.departmentProjects.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {statusLabel(item.status)}
                    </span>
                  </Link>
                </li>
              ))}
            </ListCard>

            <ListCard title={t("overdueTasks")} empty={t("noOverdue")}>
              {data.overdueTasks.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="font-medium">{item.title}</span>
                    <span className="text-muted-foreground">
                      {item.projectName ? `${item.projectName} · ` : ""}
                      {item.dueDate
                        ? t("dueDate", { date: formatDate(item.dueDate) })
                        : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ListCard>

            <ListCard title={t("teamWorkload")} empty={t("noWorkload")}>
              {data.teamWorkload.map((item) => (
                <li key={item.userId}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-foreground"
                  >
                    <span className="min-w-0 truncate font-medium">
                      {item.fullName}
                    </span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {t("activeTasks", { count: item.activeTaskCount })} ·{" "}
                      {t("estimatedHours", { hours: item.estimatedHours })}
                    </span>
                  </Link>
                </li>
              ))}
            </ListCard>

            <Card>
              <CardHeader>
                <CardTitle>{t("metricPendingApprovals")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingLeave")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.leave}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingExtension")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.extension}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingExcusal")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.excusal}
                    </span>
                  </li>
                  <li className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                    {t("pendingAttendance")}:{" "}
                    <span className="font-medium tabular-nums">
                      {data.pendingApprovals.attendance}
                    </span>
                  </li>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/approvals"
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    {t("viewApprovals")}
                  </Link>
                  <Link
                    href="/attendance"
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                  >
                    {t("viewAttendance")}
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}

      {data.role === "employee" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ListCard title={t("assignedTasks")} empty={t("noAssigned")}>
            {data.assignedTasks.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-col gap-0.5 py-2.5 text-sm hover:text-foreground"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground">
                    {statusLabel(item.status)}
                    {item.dueDate
                      ? ` · ${t("dueDate", { date: formatDate(item.dueDate) })}`
                      : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ListCard>

          <ListCard title={t("upcomingDeadlines")} empty={t("noDeadlines")}>
            {data.upcomingDeadlines.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex flex-col gap-0.5 py-2.5 text-sm hover:text-foreground"
                >
                  <span className="font-medium">{item.title}</span>
                  <span className="text-muted-foreground">
                    {item.dueDate
                      ? t("dueDate", { date: formatDate(item.dueDate) })
                      : null}
                  </span>
                </Link>
              </li>
            ))}
          </ListCard>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <CardTitle>{t("attendanceSummary")}</CardTitle>
              <Link
                href={data.attendanceSummary.href}
                className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
              >
                {t("viewAttendance")}
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-lg font-semibold tabular-nums text-primary">
                {t("monthHours", {
                  hours: data.attendanceSummary.totalHours,
                })}
              </p>
              <p className="text-muted-foreground">
                {t("approvedDays", {
                  count: data.attendanceSummary.approvedDays,
                })}{" "}
                ·{" "}
                {t("pendingDays", {
                  count: data.attendanceSummary.pendingDays,
                })}{" "}
                ·{" "}
                {t("rejectedDays", {
                  count: data.attendanceSummary.rejectedDays,
                })}
              </p>
            </CardContent>
          </Card>

          <ListCard title={t("myRequests")} empty={t("noRequests")}>
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
          </ListCard>
        </div>
      ) : null}
    </div>
  );
}
