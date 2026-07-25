import { describe, expect, it } from "vitest";

import { createCommentSchema, updateCommentSchema } from "@/features/tasks/schemas/comment.schema";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentFileMetaSchema,
} from "@/features/tasks/schemas/attachment.schema";
import { listTasksQuerySchema, updateTaskSchema } from "@/features/tasks/schemas/task.schema";
import { ganttQuerySchema } from "@/features/gantt/schemas/gantt.schema";
import {
  isTaskOverdue,
  resolveBarDates,
} from "@/features/gantt/lib/gantt-helpers";

describe("milestone 9 schemas", () => {
  it("accepts departmentId on list tasks", () => {
    const result = listTasksQuerySchema.safeParse({
      departmentId: "11111111-1111-4111-8111-111111111111",
      pageSize: "25",
    });
    expect(result.success).toBe(true);
  });

  it("accepts progressPercentage on update", () => {
    const result = updateTaskSchema.safeParse({ progressPercentage: 40 });
    expect(result.success).toBe(true);
  });

  it("rejects progressPercentage above 100", () => {
    const result = updateTaskSchema.safeParse({ progressPercentage: 101 });
    expect(result.success).toBe(false);
  });

  it("requires non-empty comment content", () => {
    expect(createCommentSchema.safeParse({ content: "   " }).success).toBe(
      false,
    );
    expect(createCommentSchema.safeParse({ content: "مرحبا" }).success).toBe(
      true,
    );
    expect(updateCommentSchema.safeParse({ content: "تحديث" }).success).toBe(
      true,
    );
  });

  it("validates attachment metadata limits", () => {
    expect(
      attachmentFileMetaSchema.safeParse({
        fileName: "note.pdf",
        contentType: "application/pdf",
        byteSize: MAX_ATTACHMENT_BYTES,
      }).success,
    ).toBe(true);
    expect(
      attachmentFileMetaSchema.safeParse({
        fileName: "huge.bin",
        byteSize: MAX_ATTACHMENT_BYTES + 1,
      }).success,
    ).toBe(false);
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toContain("application/pdf");
  });

  it("parses gantt query filters", () => {
    const result = ganttQuerySchema.safeParse({
      status: "in_progress",
      dueFrom: "2026-07-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("gantt helpers", () => {
  it("resolves bar dates with start and due", () => {
    expect(
      resolveBarDates({
        startDate: "2026-07-01",
        dueDate: "2026-07-10",
        createdAt: "2026-06-01T00:00:00Z",
      }),
    ).toEqual({ barStart: "2026-07-01", barEnd: "2026-07-10" });
  });

  it("falls back when start is missing", () => {
    expect(
      resolveBarDates({
        startDate: null,
        dueDate: "2026-07-10",
        createdAt: "2026-06-01T00:00:00Z",
      }),
    ).toEqual({ barStart: "2026-07-09", barEnd: "2026-07-10" });
  });

  it("marks incomplete past-due tasks overdue", () => {
    expect(
      isTaskOverdue({
        dueDate: "2026-07-01",
        status: "in_progress",
        today: "2026-07-25",
      }),
    ).toBe(true);
    expect(
      isTaskOverdue({
        dueDate: "2026-07-01",
        status: "completed",
        today: "2026-07-25",
      }),
    ).toBe(false);
  });
});
