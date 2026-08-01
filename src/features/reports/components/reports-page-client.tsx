"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { Department } from "@/features/departments/types/department.types";
import type {
  AttendanceSummaryRow,
  EmployeeWorkloadRow,
  ReportListResult,
  ReportType,
  TaskCompletionRow,
  WorkLogSummaryRow,
} from "@/features/reports/types/report.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { SortableTableHead } from "@/components/shared/sortable-table-head";
import { TablePagination } from "@/components/shared/table-pagination";
import { Tabs, TabPanel } from "@/components/shared/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import type { Role } from "@/lib/permissions";

type ReportsPageClientProps = {
  viewerRole: Role;
  defaultDateFrom: string;
  defaultDateTo: string;
};

type ListResult<T> = ReportListResult<T>;

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

const TAB_TO_PATH: Record<ReportType, string> = {
  "task-completion": "/api/reports/task-completion",
  "employee-workload": "/api/reports/employee-workload",
  "attendance-summary": "/api/reports/attendance-summary",
  "work-log-summary": "/api/reports/work-log-summary",
};

export function ReportsPageClient({
  viewerRole,
  defaultDateFrom,
  defaultDateTo,
}: ReportsPageClientProps) {
  const t = useTranslations("reports");
  const isAdmin = viewerRole === "admin";

  const [tab, setTab] = useState<ReportType>("task-completion");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [sortBy, setSortBy] = useState("completionRate");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [departmentId, setDepartmentId] = useState("");
  const [applied, setApplied] = useState({
    dateFrom: defaultDateFrom,
    dateTo: defaultDateTo,
    departmentId: "",
  });

  const departmentsQuery = useQuery({
    queryKey: ["reports-departments"],
    enabled: isAdmin,
    queryFn: async () => {
      const response = await fetch("/api/departments?pageSize=100");
      const data = await readApi<{ items: Department[] }>(response);
      return data.items;
    },
  });

  const defaultSortForTab = (next: ReportType): string => {
    switch (next) {
      case "task-completion":
        return "completionRate";
      case "employee-workload":
        return "capacityPercent";
      case "attendance-summary":
        return "totalHours";
      case "work-log-summary":
        return "loggedHours";
    }
  };

  const onTabChange = (id: string) => {
    const next = id as ReportType;
    setTab(next);
    setPage(1);
    setSortBy(defaultSortForTab(next));
    setSortDir("desc");
  };

  const onSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDir("desc");
    }
    setPage(1);
  };

  const applyFilters = () => {
    setApplied({
      dateFrom,
      dateTo,
      departmentId,
    });
    setPage(1);
  };

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortDir,
    });
    if (tab !== "employee-workload") {
      params.set("dateFrom", applied.dateFrom);
      params.set("dateTo", applied.dateTo);
    }
    if (isAdmin && applied.departmentId) {
      params.set("departmentId", applied.departmentId);
    }
    return params.toString();
  }, [page, pageSize, sortBy, sortDir, tab, applied, isAdmin]);

  const reportQuery = useQuery({
    queryKey: ["reports", tab, queryParams],
    queryFn: async () => {
      const response = await fetch(`${TAB_TO_PATH[tab]}?${queryParams}`);
      return readApi<
        ListResult<
          | TaskCompletionRow
          | EmployeeWorkloadRow
          | AttendanceSummaryRow
          | WorkLogSummaryRow
        >
      >(response);
    },
  });

  const tabItems = [
    { id: "task-completion", label: t("tabTaskCompletion") },
    { id: "employee-workload", label: t("tabEmployeeWorkload") },
    { id: "attendance-summary", label: t("tabAttendanceSummary") },
    { id: "work-log-summary", label: t("tabWorkLogSummary") },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab !== "employee-workload" ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="dateFrom">{t("dateFrom")}</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dateTo">{t("dateTo")}</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </>
        ) : null}
        {isAdmin ? (
          <div className="space-y-1.5">
            <Label htmlFor="departmentId">{t("department")}</Label>
            <select
              id="departmentId"
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">{t("allDepartments")}</option>
              {(departmentsQuery.data ?? []).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex items-end">
          <Button type="button" onClick={applyFilters}>
            {t("apply")}
          </Button>
        </div>
      </div>

      <Tabs items={tabItems} value={tab} onValueChange={onTabChange}>
        {(
          [
            "task-completion",
            "employee-workload",
            "attendance-summary",
            "work-log-summary",
          ] as ReportType[]
        ).map((id) => (
          <TabPanel key={id} when={id} active={tab}>
            {reportQuery.isLoading ? <LoadingState /> : null}
            {reportQuery.isError ? (
              <ErrorState
                title={t("emptyTitle")}
                description={
                  reportQuery.error instanceof Error
                    ? reportQuery.error.message
                    : undefined
                }
                onRetry={() => void reportQuery.refetch()}
              />
            ) : null}
            {reportQuery.data && reportQuery.data.items.length === 0 ? (
              <EmptyState
                title={t("emptyTitle")}
                description={t("emptyDescription")}
              />
            ) : null}
            {reportQuery.data && reportQuery.data.items.length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead
                          label={t("colEmployee")}
                          column="fullName"
                          sortBy={sortBy}
                          sortDir={sortDir}
                          onSort={onSort}
                        />
                        <th className="h-10 px-2 text-start text-sm font-medium">
                          {t("colEmployeeNumber")}
                        </th>
                        <th className="h-10 px-2 text-start text-sm font-medium">
                          {t("colDepartment")}
                        </th>
                        {id === "task-completion" ? (
                          <>
                            <SortableTableHead
                              label={t("colCompleted")}
                              column="completedCount"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colTotal")}
                              column="totalCount"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colCompletionRate")}
                              column="completionRate"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                          </>
                        ) : null}
                        {id === "employee-workload" ? (
                          <>
                            <SortableTableHead
                              label={t("colActiveTasks")}
                              column="activeTaskCount"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colEstimatedHours")}
                              column="estimatedHours"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colAvailableHours")}
                              column="availableHours"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colCapacityPercent")}
                              column="capacityPercent"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                          </>
                        ) : null}
                        {id === "attendance-summary" ? (
                          <>
                            <SortableTableHead
                              label={t("colDays")}
                              column="days"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colTotalHours")}
                              column="totalHours"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colApprovedDays")}
                              column="approvedDays"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                          </>
                        ) : null}
                        {id === "work-log-summary" ? (
                          <>
                            <SortableTableHead
                              label={t("colLogEntries")}
                              column="logEntries"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                            <SortableTableHead
                              label={t("colLoggedHours")}
                              column="loggedHours"
                              sortBy={sortBy}
                              sortDir={sortDir}
                              onSort={onSort}
                            />
                          </>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportQuery.data.items.map((row) => (
                        <TableRow key={row.userId}>
                          <TableCell className="font-medium">
                            {row.fullName}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {row.employeeNumber}
                          </TableCell>
                          <TableCell>
                            {row.departmentName ?? "—"}
                          </TableCell>
                          {id === "task-completion" ? (
                            <>
                              <TableCell className="tabular-nums">
                                {(row as TaskCompletionRow).completedCount}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as TaskCompletionRow).totalCount}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as TaskCompletionRow).completionRate}%
                              </TableCell>
                            </>
                          ) : null}
                          {id === "employee-workload" ? (
                            <>
                              <TableCell className="tabular-nums">
                                {(row as EmployeeWorkloadRow).activeTaskCount}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as EmployeeWorkloadRow).estimatedHours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as EmployeeWorkloadRow).availableHours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {Math.round(
                                  (row as EmployeeWorkloadRow).capacityPercent,
                                )}
                                %
                              </TableCell>
                            </>
                          ) : null}
                          {id === "attendance-summary" ? (
                            <>
                              <TableCell className="tabular-nums">
                                {(row as AttendanceSummaryRow).days}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as AttendanceSummaryRow).totalHours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as AttendanceSummaryRow).approvedDays}
                              </TableCell>
                            </>
                          ) : null}
                          {id === "work-log-summary" ? (
                            <>
                              <TableCell className="tabular-nums">
                                {(row as WorkLogSummaryRow).logEntries}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {(row as WorkLogSummaryRow).loggedHours}
                              </TableCell>
                            </>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TablePagination
                  page={reportQuery.data.page}
                  pageSize={pageSize}
                  total={reportQuery.data.total}
                  onPageChange={setPage}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                  }}
                />
              </div>
            ) : null}
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
}
