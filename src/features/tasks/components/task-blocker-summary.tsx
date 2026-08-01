"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Calendar, Lock } from "lucide-react";

import type {
  IncompleteDependencySummary,
  TaskStatus,
} from "@/features/tasks/types/task.types";
import type { TaskAttachment } from "@/features/tasks/types/comment-attachment.types";
import { TaskAttachmentDownloads } from "@/features/tasks/components/task-attachment-downloads";
import { formatDate } from "@/lib/dates";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/shared/loading-state";
import { cn } from "@/lib/utils";

type TaskBlockerChipsProps = {
  blockers: IncompleteDependencySummary[];
  /** When false, summary dialog has no link to full task detail. */
  allowOpenTask?: boolean;
};

async function fetchAttachments(taskId: string): Promise<TaskAttachment[]> {
  const response = await fetch(`/api/tasks/${taskId}/attachments`);
  const payload = (await response.json()) as {
    data?: TaskAttachment[];
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data ?? [];
}

export function TaskBlockerChips({
  blockers,
  allowOpenTask = true,
}: TaskBlockerChipsProps) {
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
        allowOpenTask={allowOpenTask}
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
  allowOpenTask?: boolean;
};

function BlockerSummaryDialog({
  blocker,
  open,
  onOpenChange,
  allowOpenTask = true,
}: BlockerSummaryDialogProps) {
  const t = useTranslations("tasks");

  const attachmentsQuery = useQuery({
    queryKey: ["tasks", blocker?.id, "attachments"],
    queryFn: () => fetchAttachments(blocker!.id),
    enabled: open && blocker != null,
  });

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
          <div className="space-y-4">
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

            <div className="grid gap-2">
              <p className="text-xs text-muted-foreground">{t("tabAttachments")}</p>
              {attachmentsQuery.isLoading ? <LoadingState /> : null}
              {attachmentsQuery.isError ? (
                <p className="text-sm text-destructive">
                  {(attachmentsQuery.error as Error).message}
                </p>
              ) : null}
              {!attachmentsQuery.isLoading && !attachmentsQuery.isError ? (
                <TaskAttachmentDownloads
                  taskId={blocker.id}
                  attachments={(attachmentsQuery.data ?? []).map((item) => ({
                    id: item.id,
                    fileName: item.fileName,
                    byteSize: item.byteSize,
                    contentType: item.contentType,
                  }))}
                  emptyLabel={t("attachmentsEmptyTitle")}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        {allowOpenTask && blocker ? (
          <DialogFooter>
            <Link
              href={`/tasks/${blocker.id}`}
              className={cn(buttonVariants())}
            >
              {t("openTask")}
            </Link>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
