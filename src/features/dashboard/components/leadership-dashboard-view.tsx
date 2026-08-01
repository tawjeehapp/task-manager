import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock3,
  FolderKanban,
  Info,
  Loader2,
} from "lucide-react";

import type {
  AdminDashboard,
  ManagerDashboard,
} from "@/features/dashboard/types/dashboard.types";
import { LeadershipTablesClient } from "@/features/dashboard/components/leadership-tables-client";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type LeadershipDashboardViewProps = {
  data: AdminDashboard | ManagerDashboard;
  canViewReports: boolean;
  canApproveAttendance: boolean;
};

export async function LeadershipDashboardView({
  data,
  canViewReports,
  canApproveAttendance,
}: LeadershipDashboardViewProps) {
  const t = await getTranslations("dashboard");
  const isAdmin = data.role === "admin";
  const { metrics, attention, team, projects } = data;

  const overdueNames = attention.overduePeople
    .map((p) => p.fullName)
    .slice(0, 5)
    .join("، ");
  const missingNames = attention.missingAttendanceToday
    .map((p) => p.fullName)
    .slice(0, 8)
    .join("، ");

  const pendingParts = [
    attention.pendingApprovals.extension + attention.pendingApprovals.excusal > 0
      ? t("attentionPendingTaskRequests", {
          count:
            attention.pendingApprovals.extension +
            attention.pendingApprovals.excusal,
        })
      : null,
    attention.pendingApprovals.attendance > 0
      ? t("attentionPendingAttendance", {
          count: attention.pendingApprovals.attendance,
        })
      : null,
    attention.pendingApprovals.leave > 0
      ? t("attentionPendingLeave", {
          count: attention.pendingApprovals.leave,
        })
      : null,
  ].filter(Boolean);

  return (
    <div className="space-y-6">
      <PageHeader
        title={isAdmin ? t("leadershipTitleAdmin") : t("leadershipTitleManager")}
        description={t("leadershipDescription")}
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

      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 xl:grid-cols-6">
        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricTodo")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.todoCount}
              </CardTitle>
            </div>
            <Circle className="mt-1 size-5 shrink-0 text-muted-foreground" />
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricInProgress")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.inProgressCount}
              </CardTitle>
            </div>
            <Loader2 className="mt-1 size-5 shrink-0 text-amber-600" />
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricBlocked")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.blockedCount}
              </CardTitle>
            </div>
            <Ban className="mt-1 size-5 shrink-0 text-destructive" />
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricCompleted")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.completedCount}
              </CardTitle>
            </div>
            <CheckCircle2 className="mt-1 size-5 shrink-0 text-emerald-600" />
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricTeamWeekHours")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.weekHours}
              </CardTitle>
              <p className="text-[11px] leading-snug text-muted-foreground">
                <span className="text-emerald-700 tabular-nums">
                  {metrics.weekHoursApproved}
                </span>{" "}
                {t("metricHoursApproved")}
                {" · "}
                <span className="text-amber-700 tabular-nums">
                  {metrics.weekHoursPending}
                </span>{" "}
                {t("metricHoursPending")}
                {" · "}
                <span className="text-destructive tabular-nums">
                  {metrics.weekHoursRejected}
                </span>{" "}
                {t("metricHoursRejected")}
              </p>
            </div>
            <Clock3 className="mt-1 size-5 shrink-0 text-sky-600" />
          </CardHeader>
        </Card>

        <Card size="sm">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div className="min-w-0 space-y-1">
              <CardDescription>{t("metricProjects")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums text-primary">
                {metrics.activeProjectsCount}
              </CardTitle>
              <p className="text-[11px] leading-snug text-muted-foreground">
                {t("metricAvgProgress", {
                  percent: metrics.avgProgressPercent,
                })}
              </p>
            </div>
            <FolderKanban className="mt-1 size-5 shrink-0 text-violet-600" />
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("attentionTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-medium text-destructive">
                  {t("attentionUrgent")}
                </p>
                <p className="text-muted-foreground">
                  {metrics.overdueCount === 0
                    ? t("attentionNoOverdue")
                    : t("attentionOverdueDetail", {
                        count: metrics.overdueCount,
                        names: overdueNames || "—",
                      })}
                </p>
              </div>
            </div>
            {metrics.overdueCount > 0 ? (
              <Link
                href="/tasks"
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "shrink-0",
                )}
              >
                {t("attentionOpen")}
              </Link>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              <div className="text-sm">
                <p className="font-medium text-emerald-800">
                  {t("attentionAction")}
                </p>
                <p className="text-muted-foreground">
                  {attention.pendingApprovals.total === 0
                    ? t("attentionNoPending")
                    : pendingParts.join(" · ")}
                </p>
              </div>
            </div>
            {attention.pendingApprovals.total > 0 ? (
              <Link
                href="/approvals"
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "shrink-0",
                )}
              >
                {t("attentionOpen")}
              </Link>
            ) : null}
          </div>

          <div className="flex gap-2 rounded-lg border border-sky-200/60 bg-sky-50/50 p-3">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-700" />
            <div className="text-sm">
              <p className="font-medium text-sky-900">{t("attentionInfo")}</p>
              <p className="text-muted-foreground">
                {attention.missingAttendanceToday.length === 0
                  ? t("attentionAllClockedIn")
                  : t("attentionMissingAttendance", {
                      count: attention.missingAttendanceToday.length,
                      names: missingNames || "—",
                    })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <LeadershipTablesClient
        today={data.today}
        team={team}
        projects={projects}
        canApproveAttendance={canApproveAttendance}
      />
    </div>
  );
}
