"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { MetricTasksDialog } from "@/features/dashboard/components/employee-metric-dialogs";
import type { LeadershipLateProject } from "@/features/dashboard/types/dashboard.types";
import { addCalendarDays } from "@/lib/org-calendar";
import { formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type LeadershipAttentionOverdueTasksButtonProps = {
  today: string;
};

export function LeadershipAttentionOverdueTasksButton({
  today,
}: LeadershipAttentionOverdueTasksButtonProps) {
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

type LeadershipAttentionLateProjectsButtonProps = {
  today: string;
  projects: LeadershipLateProject[];
};

export function LeadershipAttentionLateProjectsButton({
  today,
  projects,
}: LeadershipAttentionLateProjectsButtonProps) {
  const t = useTranslations("dashboard");
  const [open, setOpen] = useState(false);

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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("lateProjectsTitle")}</DialogTitle>
          </DialogHeader>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("attentionNoLateProjects")}
            </p>
          ) : (
            <ul className="space-y-2">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={project.href}
                    className="flex items-baseline justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                    onClick={() => setOpen(false)}
                  >
                    <span className="font-medium">{project.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {project.endDate === today
                        ? t("dueTodayLabel")
                        : formatDate(project.endDate)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** @deprecated Use LeadershipAttentionOverdueTasksButton */
export const LeadershipAttentionUrgentButton =
  LeadershipAttentionOverdueTasksButton;
