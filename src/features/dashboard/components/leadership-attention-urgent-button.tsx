"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { MetricTasksDialog } from "@/features/dashboard/components/employee-metric-dialogs";
import { addCalendarDays } from "@/lib/org-calendar";
import { Button } from "@/components/ui/button";

type LeadershipAttentionUrgentButtonProps = {
  today: string;
};

export function LeadershipAttentionUrgentButton({
  today,
}: LeadershipAttentionUrgentButtonProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const yesterday = useMemo(() => addCalendarDays(today, -1), [today]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        {t("attentionOpen")}
      </Button>

      <MetricTasksDialog
        open={open}
        onOpenChange={setOpen}
        title={t("overdueTasks")}
        today={today}
        query={
          open
            ? {
                dueTo: yesterday,
                predicate: "overdue",
              }
            : null
        }
      />
    </>
  );
}
