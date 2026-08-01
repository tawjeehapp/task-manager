"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useTranslations } from "next-intl";

import type { TaskAttachment } from "@/features/tasks/types/comment-attachment.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TaskAttachmentsPanelProps = {
  taskId: string;
  viewerId: string;
  canModerate: boolean;
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
  return payload.data!;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TaskAttachmentsPanel({
  taskId,
  viewerId,
  canModerate,
}: TaskAttachmentsPanelProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const attachmentsQuery = useQuery({
    queryKey: ["tasks", taskId, "attachments"],
    queryFn: () => fetchAttachments(taskId),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch(`/api/tasks/${taskId}/attachments`, {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        data?: TaskAttachment;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("attachmentUploadFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "attachments"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      const response = await fetch(
        `/api/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("attachmentDeleteFailed"));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "attachments"],
      });
    },
  });

  async function downloadAttachment(attachmentId: string) {
    const response = await fetch(
      `/api/tasks/${taskId}/attachments/${attachmentId}/download`,
    );
    const payload = (await response.json()) as {
      data?: { url: string; fileName: string };
      error?: { message: string };
    };
    if (!response.ok || !payload.data?.url) {
      throw new Error(payload.error?.message ?? t("attachmentDownloadFailed"));
    }
    window.open(payload.data.url, "_blank", "noopener,noreferrer");
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  if (attachmentsQuery.isLoading) {
    return <LoadingState />;
  }

  if (attachmentsQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(attachmentsQuery.error as Error).message}
        onRetry={() => void attachmentsQuery.refetch()}
      />
    );
  }

  const items = attachmentsQuery.data ?? [];
  const uploading = uploadMutation.isPending;

  const uploadButton = (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={uploading}
      onClick={openFilePicker}
    >
      {uploading ? tCommon("saving") : t("attachmentUpload")}
    </Button>
  );

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            uploadMutation.mutate(file);
          }
        }}
      />

      {uploadMutation.isError || deleteMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(
              (uploadMutation.error as Error | null) ??
              (deleteMutation.error as Error | null)
            )?.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          className="px-4 py-6"
          title={t("attachmentsEmptyTitle")}
          description={t("attachmentHint")}
          action={uploadButton}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {uploadButton}
            <p className="text-muted-foreground text-xs">{t("attachmentHint")}</p>
          </div>
          <ul className="divide-border divide-y rounded-lg border">
            {items.map((item) => {
              const canDelete = item.uploadedBy === viewerId || canModerate;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="truncate text-sm font-medium">
                      {item.fileName}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {item.uploader?.fullName ?? "—"} ·{" "}
                      {formatBytes(item.byteSize)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void downloadAttachment(item.id)}
                    >
                      {t("attachmentDownload")}
                    </Button>
                    {canDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        {t("attachmentDelete")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
