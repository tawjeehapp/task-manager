"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, UserX } from "lucide-react";

import type {
  EmployeeRequest,
  EmployeeRequestType,
} from "@/features/employee-requests/types/employee-request.types";
import type { DashboardTaskItem } from "@/features/dashboard/types/dashboard.types";
import { calendarDateOnly } from "@/features/dashboard/lib/actionable-tasks";
import { addCalendarDays } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TaskRequestDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Pick<DashboardTaskItem, "id" | "title" | "dueDate"> | null;
};

async function fetchPendingRequests(taskId: string): Promise<EmployeeRequest[]> {
  const params = new URLSearchParams({
    taskId,
    status: "pending",
    page: "1",
    pageSize: "25",
  });
  const response = await fetch(`/api/employee-requests?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: { items: EmployeeRequest[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data?.items ?? [];
}

export function TaskRequestDialog({
  open,
  onOpenChange,
  task,
}: TaskRequestDialogProps) {
  const t = useTranslations("dashboard");
  const tReq = useTranslations("employeeRequests");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [requestType, setRequestType] =
    useState<EmployeeRequestType>("extension");
  const [requestedDate, setRequestedDate] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ["employee-requests", "mine", task?.id],
    queryFn: () => fetchPendingRequests(task!.id),
    enabled: open && Boolean(task?.id),
  });

  const pendingForType = (pendingQuery.data ?? []).find(
    (request) => request.type === requestType,
  );
  const isEditing = Boolean(pendingForType);

  useEffect(() => {
    if (!open) {
      setRequestType("extension");
      setRequestedDate("");
      setReason("");
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || pendingQuery.isLoading) return;

    if (pendingForType) {
      if (requestType === "extension") {
        setRequestedDate(pendingForType.requestedDate ?? "");
      } else {
        setRequestedDate("");
      }
      setReason(pendingForType.reason ?? "");
      return;
    }

    setRequestedDate("");
    setReason("");
  }, [
    open,
    requestType,
    pendingForType,
    pendingQuery.isLoading,
  ]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!task) throw new Error("No task");

      const trimmedReason = reason.trim();
      if (!trimmedReason) {
        throw new Error(tReq("reasonRequired"));
      }

      if (pendingForType) {
        const body =
          requestType === "extension"
            ? {
                requestedDate,
                reason: trimmedReason,
              }
            : {
                reason: trimmedReason,
              };

        const response = await fetch(
          `/api/employee-requests/${pendingForType.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? tReq("updateRequest"));
        }
        return;
      }

      const body =
        requestType === "extension"
          ? {
              taskId: task.id,
              type: "extension" as const,
              requestedDate,
              reason: trimmedReason,
            }
          : {
              taskId: task.id,
              type: "excusal" as const,
              reason: trimmedReason,
            };

      const response = await fetch("/api/employee-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? tReq("submit"));
      }
    },
    onSuccess: async () => {
      setError(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["employee-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const taskDueDate = calendarDateOnly(task?.dueDate ?? null);

  const canSubmit =
    !submitMutation.isPending &&
    Boolean(reason.trim()) &&
    (requestType === "excusal" || Boolean(requestedDate));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("taskRequestTitle")}</DialogTitle>
          {task ? (
            <p className="text-muted-foreground text-sm">
              {task.title}
              {taskDueDate
                ? ` · ${t("taskRequestDue", { date: formatDate(taskDueDate) })}`
                : ""}
            </p>
          ) : null}
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={requestType === "extension" ? "default" : "outline"}
            className="flex-1 gap-1.5"
            onClick={() => {
              setRequestType("extension");
              setError(null);
            }}
          >
            <CalendarDays className="size-3.5" />
            {t("taskRequestTabExtension")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={requestType === "excusal" ? "default" : "outline"}
            className="flex-1 gap-1.5"
            onClick={() => {
              setRequestType("excusal");
              setError(null);
            }}
          >
            <UserX className="size-3.5" />
            {t("taskRequestTabExcusal")}
          </Button>
        </div>

        {isEditing ? (
          <Alert>
            <AlertDescription>{tReq("editingPendingRequest")}</AlertDescription>
          </Alert>
        ) : null}

        {requestType === "extension" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-request-date">{tReq("requestedDate")}</Label>
              <Input
                id="task-request-date"
                type="date"
                value={requestedDate}
                min={
                  taskDueDate ? addCalendarDays(taskDueDate, 1) : undefined
                }
                onChange={(e) => setRequestedDate(e.target.value)}
              />
              {taskDueDate ? (
                <p className="text-muted-foreground text-xs">
                  {t("taskRequestExtensionHint", {
                    date: formatDate(taskDueDate),
                  })}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-request-reason-ext">
                {tReq("reason")}
                <span className="text-destructive ms-0.5" aria-hidden>
                  *
                </span>
              </Label>
              <textarea
                id="task-request-reason-ext"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
                placeholder={t("taskRequestReasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t("taskRequestExtensionNote")}
            </p>
          </div>
        ) : null}

        {requestType === "excusal" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-request-reason-exc">
                {tReq("reason")}
                <span className="text-destructive ms-0.5" aria-hidden>
                  *
                </span>
              </Label>
              <textarea
                id="task-request-reason-exc"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring/50 flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-[3px] focus-visible:outline-none"
                placeholder={t("taskRequestExcusalPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>
            <p className="text-muted-foreground text-xs">
              {t("taskRequestExcusalNote")}
            </p>
          </div>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending
              ? tCommon("saving")
              : isEditing
                ? tReq("updateRequest")
                : tReq("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
