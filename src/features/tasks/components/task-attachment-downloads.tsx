"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip } from "lucide-react";

import type { TaskAttachmentSummary } from "@/features/tasks/types/comment-attachment.types";
import { cn } from "@/lib/utils";

type TaskAttachmentDownloadsProps = {
  taskId: string;
  attachments: TaskAttachmentSummary[];
  /** Compact chips for table rows; list for dialogs. */
  variant?: "chips" | "list";
  className?: string;
  emptyLabel?: string;
};

async function downloadAttachment(
  taskId: string,
  attachmentId: string,
  failedMessage: string,
): Promise<void> {
  const response = await fetch(
    `/api/tasks/${taskId}/attachments/${attachmentId}/download`,
  );
  const payload = (await response.json()) as {
    data?: { url: string; fileName: string };
    error?: { message: string };
  };
  if (!response.ok || !payload.data?.url) {
    throw new Error(payload.error?.message ?? failedMessage);
  }
  window.open(payload.data.url, "_blank", "noopener,noreferrer");
}

export function TaskAttachmentDownloads({
  taskId,
  attachments,
  variant = "list",
  className,
  emptyLabel,
}: TaskAttachmentDownloadsProps) {
  const t = useTranslations("tasks");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (attachments.length === 0) {
    if (!emptyLabel) return null;
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {emptyLabel}
      </p>
    );
  }

  async function onDownload(attachmentId: string) {
    setError(null);
    setPendingId(attachmentId);
    try {
      await downloadAttachment(
        taskId,
        attachmentId,
        t("attachmentDownloadFailed"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("attachmentDownloadFailed"));
    } finally {
      setPendingId(null);
    }
  }

  if (variant === "chips") {
    return (
      <div className={cn("space-y-1", className)}>
        <ul className="flex flex-wrap gap-1">
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <button
                type="button"
                disabled={pendingId === attachment.id}
                className="inline-flex max-w-[10rem] items-center gap-1 truncate rounded-md border bg-muted/60 px-1.5 py-0.5 text-xs text-foreground underline-offset-2 hover:underline disabled:opacity-60"
                title={attachment.fileName}
                onClick={(event) => {
                  event.stopPropagation();
                  void onDownload(attachment.id);
                }}
              >
                <Paperclip className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{attachment.fileName}</span>
              </button>
            </li>
          ))}
        </ul>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      <ul className="divide-y rounded-md border">
        {attachments.map((attachment) => (
          <li
            key={attachment.id}
            className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate font-medium">{attachment.fileName}</span>
            </span>
            <button
              type="button"
              className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:opacity-60"
              disabled={pendingId === attachment.id}
              onClick={() => void onDownload(attachment.id)}
            >
              {t("attachmentDownload")}
            </button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
