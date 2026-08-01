"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import type { EmployeeWorkload } from "@/features/tasks/types/task.types";

async function fetchWorkload(userId: string): Promise<EmployeeWorkload> {
  const response = await fetch(`/api/users/${userId}/workload`);
  const payload = (await response.json()) as {
    data?: EmployeeWorkload;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

type AssigneeWorkloadHintProps = {
  userId: string | null | undefined;
  enabled?: boolean;
  className?: string;
};

export function AssigneeWorkloadHint({
  userId,
  enabled = true,
  className,
}: AssigneeWorkloadHintProps) {
  const t = useTranslations("tasks");
  const query = useQuery({
    queryKey: ["workload", userId],
    queryFn: () => fetchWorkload(userId!),
    enabled: Boolean(enabled && userId),
  });

  if (!enabled || !userId) {
    return null;
  }

  if (query.isLoading) {
    return (
      <p className={className ?? "text-muted-foreground text-xs"}>
        {t("workloadLoading")}
      </p>
    );
  }

  if (query.isError || !query.data) {
    return null;
  }

  return (
    <p className={className ?? "text-muted-foreground text-xs"}>
      {t("workloadCapacityPercent", {
        percent: Math.round(query.data.capacityPercent),
      })}
      {" · "}
      {t("workloadLoadAvailable", {
        load: query.data.estimatedHours,
        available: query.data.availableHours,
      })}
    </p>
  );
}
