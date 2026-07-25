"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { TaskComment } from "@/features/tasks/types/comment-attachment.types";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TaskCommentsPanelProps = {
  taskId: string;
  viewerId: string;
  canModerate: boolean;
};

async function fetchComments(taskId: string): Promise<TaskComment[]> {
  const response = await fetch(`/api/tasks/${taskId}/comments`);
  const payload = (await response.json()) as {
    data?: TaskComment[];
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

export function TaskCommentsPanel({
  taskId,
  viewerId,
  canModerate,
}: TaskCommentsPanelProps) {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const commentsQuery = useQuery({
    queryKey: ["tasks", taskId, "comments"],
    queryFn: () => fetchComments(taskId),
  });

  const createMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const payload = (await response.json()) as {
        data?: TaskComment;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("commentCreateFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "comments"],
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      commentId,
      content,
    }: {
      commentId: string;
      content: string;
    }) => {
      const response = await fetch(
        `/api/tasks/${taskId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        },
      );
      const payload = (await response.json()) as {
        data?: TaskComment;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("commentUpdateFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      setEditingId(null);
      setEditDraft("");
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "comments"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const response = await fetch(
        `/api/tasks/${taskId}/comments/${commentId}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("commentDeleteFailed"));
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "comments"],
      });
    },
  });

  if (commentsQuery.isLoading) {
    return <LoadingState />;
  }

  if (commentsQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(commentsQuery.error as Error).message}
        onRetry={() => void commentsQuery.refetch()}
      />
    );
  }

  const items = commentsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const content = draft.trim();
          if (!content) {
            return;
          }
          createMutation.mutate(content);
        }}
      >
        <textarea
          className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
          placeholder={t("commentPlaceholder")}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" disabled={createMutation.isPending || !draft.trim()}>
          {createMutation.isPending ? tCommon("saving") : t("commentAdd")}
        </Button>
      </form>

      {createMutation.isError ||
      updateMutation.isError ||
      deleteMutation.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {(
              (createMutation.error as Error | null) ??
              (updateMutation.error as Error | null) ??
              (deleteMutation.error as Error | null)
            )?.message}
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={t("commentsEmptyTitle")}
          description={t("commentsEmptyDescription")}
        />
      ) : (
        <ul className="divide-border divide-y rounded-lg border">
          {items.map((item) => {
            const canEdit = item.userId === viewerId;
            const canDelete = canEdit || canModerate;
            const isEditing = editingId === item.id;
            return (
              <li key={item.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">
                    {item.user?.fullName ?? "—"}
                  </p>
                  <time className="text-muted-foreground text-xs tabular-nums">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                      value={editDraft}
                      onChange={(event) => setEditDraft(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        disabled={
                          updateMutation.isPending || !editDraft.trim()
                        }
                        onClick={() =>
                          updateMutation.mutate({
                            commentId: item.id,
                            content: editDraft.trim(),
                          })
                        }
                      >
                        {tCommon("save")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        {tCommon("cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm whitespace-pre-wrap">{item.content}</p>
                )}
                {!isEditing && (canEdit || canDelete) ? (
                  <div className="flex flex-wrap gap-2">
                    {canEdit ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditDraft(item.content);
                        }}
                      >
                        {t("commentEdit")}
                      </Button>
                    ) : null}
                    {canDelete ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(item.id)}
                      >
                        {t("commentDelete")}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
