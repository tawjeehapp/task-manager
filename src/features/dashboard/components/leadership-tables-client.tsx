"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import type {
  LeadershipProjectRow,
  LeadershipTeamRow,
} from "@/features/dashboard/types/dashboard.types";
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
};

type DepartmentOption = {
  id: string;
  name: string;
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

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length >= 2
      ? `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`
      : (parts[0]?.slice(0, 2) ?? "?");
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
      {letters}
    </span>
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

export function LeadershipTablesClient({
  today,
  team,
  projects,
}: LeadershipTablesClientProps) {
  const t = useTranslations("dashboard");
  const [teamSearch, setTeamSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [departmentId, setDepartmentId] = useState("");

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

  const filteredTeam = useMemo(() => {
    const q = teamSearch.trim().toLowerCase();
    return team.filter((row) => {
      if (!matchesDepartment(row, departmentId)) return false;
      if (q && !row.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [team, teamSearch, departmentId]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    return projects.filter((row) => {
      if (!matchesDepartment(row, departmentId)) return false;
      if (q && !row.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [projects, projectSearch, departmentId]);

  const maxOpen = Math.max(
    1,
    ...filteredTeam.map((row) => row.openTaskCount),
    0,
  );

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
                  total: team.length,
                })}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colMember")}</TableHead>
                    <TableHead>{t("colWorkload")}</TableHead>
                    <TableHead className="text-center">
                      {t("colInProgress")}
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
                          className="flex items-center gap-2 hover:underline"
                        >
                          {row.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={row.avatarUrl}
                              alt=""
                              className="size-8 rounded-full object-cover"
                            />
                          ) : (
                            <Initials name={row.fullName} />
                          )}
                          <span className="font-medium">{row.fullName}</span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ProgressBar
                          value={(row.openTaskCount / maxOpen) * 100}
                        />
                        <span className="sr-only">
                          {t("openTasksCount", { count: row.openTaskCount })}
                        </span>
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.inProgressCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-center tabular-nums",
                          row.overdueCount > 0 &&
                            "font-medium text-destructive",
                        )}
                      >
                        {row.overdueCount}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.dueTodayCount}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.weekHours}
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
                      {t("colInProgress")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colOverdue")}
                    </TableHead>
                    <TableHead className="text-center">
                      {t("colEstimated")}
                    </TableHead>
                    <TableHead>{t("colNearestDue")}</TableHead>
                    <TableHead>{t("colHealth")}</TableHead>
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
                          tone={row.health === "overdue" ? "warn" : "default"}
                        />
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.inProgressCount}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-center tabular-nums",
                          row.overdueCount > 0 && "text-destructive",
                        )}
                      >
                        {row.overdueCount}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.estimatedHoursSum}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.nearestDueDate
                          ? row.nearestDueDate === today
                            ? t("dueTodayLabel")
                            : formatDate(row.nearestDueDate)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.health === "overdue"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {t(`health_${row.health}`)}
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
    </div>
  );
}
