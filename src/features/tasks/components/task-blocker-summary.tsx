"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Lock } from "lucide-react";

import type {
  IncompleteDependencySummary,
  TaskStatus,
} from "@/features/tasks/types/task.types";
import { formatDate } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type TaskBlockerChipsProps = {
  blockers: IncompleteDependencySummary[];
};

export function TaskBlockerChips({ blockers }: TaskBlockerChipsProps) {
  const t = useTranslations("tasks");
  const [selected, setSelected] = useState<IncompleteDependencySummary | null>(
    null,
  );

  if (blockers.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mt-2 space-y-1.5">
        <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3 shrink-0" aria-hidden />
          {t("boardBlockedBy")}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {blockers.map((blocker) => (
            <li key={blocker.id}>
              <button
                type="button"
                className="max-w-full truncate rounded-md border bg-muted/60 px-1.5 py-0.5 text-start text-xs text-foreground underline-offset-2 hover:underline"
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected(blocker);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                {blocker.title}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <BlockerSummaryDialog
        blocker={selected}
        open={selected != null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </>
  );
}

type BlockerSummaryDialogProps = {
  blocker: IncompleteDependencySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function BlockerSummaryDialog({
  blocker,
  open,
  onOpenChange,
}: BlockerSummaryDialogProps) {
  const t = useTranslations("tasks");

  function statusLabel(status: TaskStatus) {
    return t(`status_${status}` as "status_todo");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{blocker?.title ?? t("blockerSummaryTitle")}</DialogTitle>
        </DialogHeader>

        {blocker ? (
          <dl className="grid gap-3 text-sm">
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("status")}</dt>
              <dd>{statusLabel(blocker.status)}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("assignee")}</dt>
              <dd>{blocker.assignee?.fullName ?? t("unassigned")}</dd>
            </div>
            <div className="grid gap-0.5">
              <dt className="text-xs text-muted-foreground">{t("dueDate")}</dt>
              <dd className="inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                {blocker.dueDate
                  ? formatDate(blocker.dueDate, "D MMMM")
                  : "—"}
              </dd>
            </div>
          </dl>
        ) : null}

        <DialogFooter>
          {blocker ? (
            <Link
              href={`/tasks/${blocker.id}`}
              className={cn(buttonVariants())}
            >
              {t("openTask")}
            </Link>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
