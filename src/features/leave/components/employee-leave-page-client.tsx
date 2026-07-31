"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { LeaveRequestForm } from "@/features/leave/components/leave-request-form";
import type { LeaveRequest, LeaveType } from "@/features/leave/types/leave.types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/dates";

type LeaveListResult = {
  items: LeaveRequest[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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

function statusBadgeVariant(
  status: LeaveRequest["status"],
): "default" | "secondary" | "destructive" {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export function EmployeeLeavePageClient() {
  const t = useTranslations("leave");
  const tCommon = useTranslations("common");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const year = new Date().getFullYear();

  const typesQuery = useQuery({
    queryKey: ["leave-types"],
    queryFn: async () => {
      const response = await fetch("/api/leave-types");
      return readApi<LeaveType[]>(response);
    },
  });

  const requestsQuery = useQuery({
    queryKey: ["leave-requests", "employee-all"],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "100",
        sortBy: "created_at",
        sortDir: "desc",
      });
      const response = await fetch(`/api/leave-requests?${params}`);
      return readApi<LeaveListResult>(response);
    },
  });

  const stats = useMemo(() => {
    const items = requestsQuery.data?.items ?? [];
    const yearItems = items.filter((row) =>
      row.startDate.startsWith(String(year)),
    );
    const approved = yearItems.filter((row) => row.status === "approved");
    return {
      approvedCount: approved.length,
      approvedDays: approved.reduce((sum, row) => sum + row.days, 0),
    };
  }, [requestsQuery.data, year]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("employeeTitle")}
        description={t("employeeDescription")}
        actions={
          <Button type="button" onClick={() => setDialogOpen(true)}>
            {t("newRequest")}
          </Button>
        }
      />

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card size="sm">
          <CardHeader className="pb-0">
            <CardDescription>{t("statApprovedLeaves")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {requestsQuery.isLoading
                ? "—"
                : t("approvedLeavesCount", { count: stats.approvedCount })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card size="sm">
          <CardHeader className="pb-0">
            <CardDescription>{t("statApprovedDays")}</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {requestsQuery.isLoading
                ? "—"
                : t("approvedDaysCount", { count: stats.approvedDays })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("myLeavesTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          {requestsQuery.isLoading ? <LoadingState /> : null}
          {requestsQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(requestsQuery.error as Error).message}
              onRetry={() => void requestsQuery.refetch()}
            />
          ) : null}
          {requestsQuery.data && requestsQuery.data.items.length === 0 ? (
            <EmptyState
              title={t("emptyRequestsTitle")}
              description={t("emptyRequestsDescription")}
            />
          ) : null}
          {requestsQuery.data && requestsQuery.data.items.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("leaveType")}</TableHead>
                  <TableHead>{t("startDate")}</TableHead>
                  <TableHead>{t("endDate")}</TableHead>
                  <TableHead>{t("days")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requestsQuery.data.items.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.leaveType?.name ?? "—"}</TableCell>
                    <TableCell>{formatDate(row.startDate)}</TableCell>
                    <TableCell>{formatDate(row.endDate)}</TableCell>
                    <TableCell>{row.days}</TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(row.status)}>
                        {t(`status_${row.status}`)}
                      </Badge>
                      {row.rejectionReason ? (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {t("rejectionReason", {
                            reason: row.rejectionReason,
                          })}
                        </p>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newRequest")}</DialogTitle>
          </DialogHeader>
          {typesQuery.isLoading ? <LoadingState /> : null}
          {typesQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={(typesQuery.error as Error).message}
              onRetry={() => void typesQuery.refetch()}
            />
          ) : null}
          {typesQuery.data ? (
            <LeaveRequestForm
              leaveTypes={typesQuery.data}
              resetOnSuccess
              submitLabel={t("submitRequest")}
              onSuccess={() => {
                setSuccessMessage(t("createSuccess"));
                setDialogOpen(false);
              }}
            />
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
