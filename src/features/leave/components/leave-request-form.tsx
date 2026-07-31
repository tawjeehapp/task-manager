"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { computeWorkingDays } from "@/features/leave/services/compute-working-days";
import type { LeaveRequest, LeaveType } from "@/features/leave/types/leave.types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LeaveRequestFormProps = {
  leaveTypes: LeaveType[];
  onSuccess?: () => void;
  /** When true, resets fields after successful submit. */
  resetOnSuccess?: boolean;
  submitLabel?: string;
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

export function LeaveRequestForm({
  leaveTypes,
  onSuccess,
  resetOnSuccess = true,
  submitLabel,
}: LeaveRequestFormProps) {
  const t = useTranslations("leave");
  const queryClient = useQueryClient();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const activeTypes = leaveTypes.filter((type) => type.isActive);

  const computedDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    try {
      return computeWorkingDays(startDate, endDate);
    } catch {
      return null;
    }
  }, [startDate, endDate]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaveTypeId,
          startDate,
          endDate,
          reason: reason.trim() || null,
        }),
      });
      return readApi<LeaveRequest>(response);
    },
    onSuccess: async () => {
      setFormError(null);
      if (resetOnSuccess) {
        setLeaveTypeId("");
        setStartDate("");
        setEndDate("");
        setReason("");
      }
      await queryClient.invalidateQueries({ queryKey: ["leave-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["leave-balances"] });
      onSuccess?.();
    },
    onError: (error: Error) => setFormError(error.message),
  });

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!leaveTypeId || !startDate || !endDate) {
      setFormError(t("formIncomplete"));
      return;
    }
    if (computedDays == null) {
      setFormError(t("invalidDateRange"));
      return;
    }
    createMutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="leaveType">{t("leaveType")}</Label>
          <select
            id="leaveType"
            className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            value={leaveTypeId}
            onChange={(e) => setLeaveTypeId(e.target.value)}
          >
            <option value="">{t("selectType")}</option>
            {activeTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leaveStartDate">{t("dateFrom")}</Label>
          <Input
            id="leaveStartDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leaveEndDate">{t("dateTo")}</Label>
          <Input
            id="leaveEndDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="leaveDuration">{t("durationLabel")}</Label>
          <Input
            id="leaveDuration"
            readOnly
            value={
              computedDays != null
                ? t("durationDays", { count: computedDays })
                : "—"
            }
            className="bg-muted/40"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="leaveReason">{t("reason")}</Label>
          <Input
            id="leaveReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("reasonPlaceholder")}
          />
        </div>
      </div>

      <Button type="submit" disabled={createMutation.isPending}>
        {createMutation.isPending
          ? t("submitting")
          : (submitLabel ?? t("submitRequest"))}
      </Button>
    </form>
  );
}
