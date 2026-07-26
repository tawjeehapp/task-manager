import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  AlertTriangle,
  CheckCircle2,
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
};

export async function LeadershipDashboardView({
  data,
  canViewReports,
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card size="sm" className="border-violet-200/60 bg-violet-50/40">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div>
              <CardDescription>{t("metricProjects")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {metrics.activeProjectsCount}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("metricAvgProgress", {
                  percent: metrics.avgProgressPercent,
                })}
              </p>
            </div>
            <FolderKanban className="size-5 text-violet-600" />
          </CardHeader>
        </Card>

        <Card size="sm" className="border-amber-200/60 bg-amber-50/40">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div>
              <CardDescription>{t("metricInProgress")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {metrics.inProgressCount}
              </CardTitle>
            </div>
            <Loader2 className="size-5 text-amber-600" />
          </CardHeader>
        </Card>

        <Card size="sm" className="border-red-200/60 bg-red-50/40">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div>
              <CardDescription>{t("metricOverdue")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {metrics.overdueCount}
              </CardTitle>
            </div>
            <AlertTriangle className="size-5 text-destructive" />
          </CardHeader>
        </Card>

        <Card size="sm" className="border-sky-200/60 bg-sky-50/40">
          <CardHeader className="flex flex-row items-start justify-between gap-2 pb-0">
            <div>
              <CardDescription>{t("metricTeamWeekHours")}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">
                {t("hoursValue", { hours: metrics.weekHours })}
              </CardTitle>
            </div>
            <Clock3 className="size-5 text-sky-600" />
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
              <div className="flex shrink-0 flex-wrap gap-2">
                <Link
                  href="/approvals"
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
                >
                  {t("attentionOpen")}
                </Link>
                {attention.pendingApprovals.attendance > 0 ? (
                  <Link
                    href="/attendance"
                    className={cn(
                      buttonVariants({ size: "sm", variant: "outline" }),
                    )}
                  >
                    {t("viewAttendance")}
                  </Link>
                ) : null}
              </div>
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
      />
    </div>
  );
}
