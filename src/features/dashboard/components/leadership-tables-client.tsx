"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import {
  MemberWeekHoursDialog,
  MetricTasksDialog,
  type MetricTasksQuery,
} from "@/features/dashboard/components/employee-metric-dialogs";
import type {
  LeadershipDepartmentRow,
  LeadershipProjectRow,
  LeadershipTeamRow,
} from "@/features/dashboard/types/dashboard.types";
import { addCalendarDays, currentWeekBounds } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type LeadershipTablesClientProps = {
  today: string;
  team: LeadershipTeamRow[];
  projects: LeadershipProjectRow[];
  departments?: LeadershipDepartmentRow[];
  /** When true, Team table defaults to department managers only. */
  preferManagersInTeam?: boolean;
  canApproveAttendance?: boolean;
};

type DepartmentOption = {
  id: string;
  name: string;
};

type OpenDetail =
  | {
      kind: "team-tasks";
      subject: string;
      metric: string;
      query: MetricTasksQuery;
    }
  | {
      kind: "project-tasks";
      subject: string;
      metric: string;
      query: MetricTasksQuery;
    }
  | {
      kind: "department-tasks";
      subject: string;
      metric: string;
      query: MetricTasksQuery;
    }
  | {
      kind: "week-hours";
      subject: string;
      userId: string;
      weekHours: number;
    };

function ProgressBar({
  value,
  tone,
}: {
  value: number;
  tone?: "default" | "warn";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex min-w-[72px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "warn" ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-10 text-end text-xs tabular-nums text-muted-foreground">
        {Math.round(clamped)}%
      </span>
    </div>
  );
}

function matchesDepartment(
  row: { departmentId: string | null; departmentName: string | null },
  departmentId: string,
): boolean {
  if (!departmentId) return true;
  if (row.departmentId) return row.departmentId === departmentId;
  return false;
}

function CountButton({
  value,
  onClick,
  className,
}: {
  value: number | string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "mx-auto block min-w-8 rounded-md px-1.5 py-0.5 tabular-nums underline-offset-2 transition-colors hover:bg-muted hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {value}
    </button>
  );
}

export function LeadershipTablesClient({
  today,
  team,
  projects,
  departments,
  preferManagersInTeam = false,
  canApproveAttendance = false,
}: LeadershipTablesClientProps) {
  const t = useTranslations("dashboard");
  const [teamSearch, setTeamSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [departmentSearch, setDepartmentSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [showEveryone, setShowEveryone] = useState(false);
  const [detail, setDetail] = useState<OpenDetail | null>(null);

  const { start: weekStart, end: weekEnd } = useMemo(
    () => currentWeekBounds(today),
    [today],
  );
  const yesterday = useMemo(() => addCalendarDays(today, -1), [today]);

  const departmentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of team) {
      if (row.departmentId && row.departmentName) {
        map.set(row.departmentId, row.departmentName);
      }
    }
    for (const row of projects) {
      if (row.departmentId && row.departmentName) {
        map.set(row.departmentId, row.departmentName);
      }
    }
    const options: DepartmentOption[] = [...map.entries()].map(([id, name]) => ({
      id,
      name,
    }));
    options.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    return options;
  }, [team, projects]);

  const showDepartmentFilter = departmentOptions.length >= 2;
  const managersOnly = preferManagersInTeam && !showEveryone;

  const teamAfterDeptAndSearch = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return team.filter((row) => {
      if (!matchesDepartment(row, departmentId)) return false;
      if (q && !row.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, teamSearch, departmentId]);

  const filteredTeam = useMemo(() => {
    if (!managersOnly) return teamAfterDeptAndSearch;
    return teamAfterDeptAndSearch.filter(
      (row) => row.role === "department_manager",
    );
  }, [teamAfterDeptAndSearch, managersOnly]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((row) => {
      if (!matchesDepartment(row, departmentId)) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, projectSearch, departmentId]);

  const filteredDepartments = useMemo(() => {
    if (!departments) return [];
    const q = departmentSearch.trim().toLowerCase();
    return departments.filter((row) => {
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [departments, departmentSearch]);

  const tasksDetailOpen =
    detail?.kind === "team-tasks" ||
    detail?.kind === "project-tasks" ||
    detail?.kind === "department-tasks";
  const tasksTitle =
    detail &&
    (detail.kind === "team-tasks" ||
      detail.kind === "project-tasks" ||
      detail.kind === "department-tasks")
      ? t("detailModalTitle", {
          subject: detail.subject,
          metric: detail.metric,
        })
      : "";
  const tasksQuery =
    detail &&
    (detail.kind === "team-tasks" ||
      detail.kind === "project-tasks" ||
      detail.kind === "department-tasks")
      ? detail.query
      : null;

  return (
    <div className="space-y-6">
      {showDepartmentFilter ? (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="leadershipDeptFilter" className="text-sm font-medium">
            {t("filterDepartment")}
          </label>
          <select
            id="leadershipDeptFilter"
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
          >
            <option value="">{t("filterAllDepartments")}</option>
            {departmentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("teamTableTitle")}</CardTitle>
          <div className="flex w-full flex-col gap-2 sm:max-w-md sm:items-end">
            {preferManagersInTeam ? (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={showEveryone}
                  onChange={(e) => setShowEveryone(e.target.checked)}
                />
                {t("showAllEmployees")}
              </label>
            ) : null}
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder={t("searchEmployeePlaceholder")}
                className="ps-8"
                aria-label={t("searchEmployeePlaceholder")}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noTeam")}</p>
          ) : filteredTeam.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("filterNoResults")}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("filterResultCount", {
                  shown: filteredTeam.length,
                  total: teamAfterDeptAndSearch.length,
                })}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colMember")}</TableHead>
                    <TableHead>{t("colDepartment")}</TableHead>
                    <TableHead>{t("colWorkload")}</TableHead>
                    <TableHead className="text-center">
                      {t("colTodo")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colInProgress")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colBlocked")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colCompleted")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colOverdue")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colDueToday")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colWeekHours")}
                    </TableHead>
                    <TableHead>{t("colTodayStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTeam.map((row) => (
                    <TableRow key={row.userId}>
                      <TableCell>
                        <Link
                          href={row.href}
                          className="font-medium hover:underline"
                        >
                          {row.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.departmentName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={row.capacityPercent}
                          tone={row.capacityPercent > 100 ? "warn" : "default"}
                        />
                        <span className="sr-only">
                          {t("capacityLoadAvailable", {
                            load: row.loadHours,
                            available: row.availableHours,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.todoCount}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colTodo"),
                              query: {
                                assignee: row.userId,
                                status: "todo",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.inProgressCount}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colInProgress"),
                              query: {
                                assignee: row.userId,
                                status: "in_progress",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.blockedCount}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colBlocked"),
                              query: {
                                assignee: row.userId,
                                status: "blocked",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.completedCount}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colCompleted"),
                              query: {
                                assignee: row.userId,
                                status: "completed",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.overdueCount}
                          className={cn(
                            row.overdueCount > 0 &&
                              "font-medium text-destructive",
                          )}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colOverdue"),
                              query: {
                                assignee: row.userId,
                                dueTo: yesterday,
                                predicate: "overdue",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.dueTodayCount}
                          onClick={() =>
                            setDetail({
                              kind: "team-tasks",
                              subject: row.fullName,
                              metric: t("colDueToday"),
                              query: {
                                assignee: row.userId,
                                dueFrom: today,
                                dueTo: today,
                                predicate: "dueToday",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          className="mx-auto block min-w-[7.5rem] rounded-md px-1.5 py-0.5 text-start hover:bg-muted/60"
                          onClick={() =>
                            setDetail({
                              kind: "week-hours",
                              subject: row.fullName,
                              userId: row.userId,
                              weekHours: row.weekHours,
                            })
                          }
                        >
                          <span className="block text-sm font-medium tabular-nums">
                            {t("hoursValue", { hours: row.weekHours })}
                          </span>
                          <span className="mt-1 block space-y-0.5 text-[11px] leading-snug text-muted-foreground">
                            <span className="flex items-center justify-between gap-2">
                              <span>{t("metricHoursApproved")}</span>
                              <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                                {row.weekHoursApproved}
                              </span>
                            </span>
                            <span className="flex items-center justify-between gap-2">
                              <span>{t("metricHoursPending")}</span>
                              <span className="tabular-nums text-amber-700 dark:text-amber-400">
                                {row.weekHoursPending}
                              </span>
                            </span>
                            <span className="flex items-center justify-between gap-2">
                              <span>{t("metricHoursRejected")}</span>
                              <span className="tabular-nums text-destructive">
                                {row.weekHoursRejected}
                              </span>
                            </span>
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.todayStatus === "missing"
                              ? "destructive"
                              : row.todayStatus === "working"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {t(`todayStatus_${row.todayStatus}`)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {departments ? (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>{t("departmentsTableTitle")}</CardTitle>
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={departmentSearch}
                onChange={(e) => setDepartmentSearch(e.target.value)}
                placeholder={t("searchDepartmentPlaceholder")}
                className="ps-8"
                aria-label={t("searchDepartmentPlaceholder")}
              />
            </div>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("noDepartments")}
              </p>
            ) : filteredDepartments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("filterNoResults")}
              </p>
            ) : (
              <>
                <p className="mb-2 text-xs text-muted-foreground">
                  {t("filterResultCount", {
                    shown: filteredDepartments.length,
                    total: departments.length,
                  })}
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colDepartment")}</TableHead>
                      <TableHead>{t("colManager")}</TableHead>
                      <TableHead className="text-center">
                        {t("colMembers")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colProjects")}
                      </TableHead>
                      <TableHead>{t("colProgress")}</TableHead>
                      <TableHead className="text-center">
                        {t("colTodo")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colInProgress")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colBlocked")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colCompleted")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colOverdue")}
                      </TableHead>
                      <TableHead className="text-center">
                        {t("colDueToday")}
                      </TableHead>
                      <TableHead>{t("colNearestDue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDepartments.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Link
                            href={row.href}
                            className="font-medium hover:underline"
                          >
                            {row.name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.managerName ?? "—"}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.memberCount}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.projectCount}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={row.progressPercent}
                            tone={
                              row.overdueCount > 0 ? "warn" : "default"
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.todoCount}
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colTodo"),
                                query: {
                                  departmentId: row.id,
                                  status: "todo",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.inProgressCount}
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colInProgress"),
                                query: {
                                  departmentId: row.id,
                                  status: "in_progress",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.blockedCount}
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colBlocked"),
                                query: {
                                  departmentId: row.id,
                                  status: "blocked",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.completedCount}
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colCompleted"),
                                query: {
                                  departmentId: row.id,
                                  status: "completed",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.overdueCount}
                            className={
                              row.overdueCount > 0
                                ? "text-destructive"
                                : undefined
                            }
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colOverdue"),
                                query: {
                                  departmentId: row.id,
                                  dueTo: yesterday,
                                  predicate: "overdue",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <CountButton
                            value={row.dueTodayCount}
                            onClick={() =>
                              setDetail({
                                kind: "department-tasks",
                                subject: row.name,
                                metric: t("colDueToday"),
                                query: {
                                  departmentId: row.id,
                                  dueFrom: today,
                                  dueTo: today,
                                  predicate: "dueToday",
                                },
                              })
                            }
                          />
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {row.nearestDueDate
                            ? row.nearestDueDate === today
                              ? t("dueTodayLabel")
                              : formatDate(row.nearestDueDate)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t("projectsTableTitle")}</CardTitle>
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              placeholder={t("searchProjectPlaceholder")}
              className="ps-8"
              aria-label={t("searchProjectPlaceholder")}
            />
          </div>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noProjects")}</p>
          ) : filteredProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("filterNoResults")}</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("filterResultCount", {
                  shown: filteredProjects.length,
                  total: projects.length,
                })}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colProject")}</TableHead>
                    <TableHead>{t("colDepartment")}</TableHead>
                    <TableHead>{t("colProgress")}</TableHead>
                    <TableHead className="text-center">
                      {t("colTodo")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colInProgress")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colBlocked")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colCompleted")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colOverdue")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colDueToday")}
                    </TableHead>
                    <TableHead>{t("colNearestDue")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={row.href}
                          className="font-medium hover:underline"
                        >
                          {row.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.departmentName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={row.progressPercent}
                          tone={row.overdueCount > 0 ? "warn" : "default"}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.todoCount}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colTodo"),
                              query: {
                                projectId: row.id,
                                status: "todo",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.inProgressCount}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colInProgress"),
                              query: {
                                projectId: row.id,
                                status: "in_progress",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.blockedCount}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colBlocked"),
                              query: {
                                projectId: row.id,
                                status: "blocked",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.completedCount}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colCompleted"),
                              query: {
                                projectId: row.id,
                                status: "completed",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.overdueCount}
                          className={cn(
                            row.overdueCount > 0 && "text-destructive",
                          )}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colOverdue"),
                              query: {
                                projectId: row.id,
                                dueTo: yesterday,
                                predicate: "overdue",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <CountButton
                          value={row.dueTodayCount}
                          onClick={() =>
                            setDetail({
                              kind: "project-tasks",
                              subject: row.name,
                              metric: t("colDueToday"),
                              query: {
                                projectId: row.id,
                                dueFrom: today,
                                dueTo: today,
                                predicate: "dueToday",
                              },
                            })
                          }
                        />
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.nearestDueDate
                          ? row.nearestDueDate === today
                            ? t("dueTodayLabel")
                            : formatDate(row.nearestDueDate)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <MetricTasksDialog
        open={tasksDetailOpen}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={tasksTitle}
        today={today}
        query={tasksQuery}
      />

      <MemberWeekHoursDialog
        open={detail?.kind === "week-hours"}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
        title={
          detail?.kind === "week-hours"
            ? t("detailModalTitle", {
                subject: detail.subject,
                metric: t("colWeekHours"),
              })
            : ""
        }
        userId={detail?.kind === "week-hours" ? detail.userId : null}
        weekStart={weekStart}
        weekEnd={weekEnd}
        today={today}
        weekHours={detail?.kind === "week-hours" ? detail.weekHours : 0}
        canApproveAttendance={canApproveAttendance}
      />
    </div>
  );
}
