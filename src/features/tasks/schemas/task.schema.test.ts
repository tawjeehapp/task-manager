import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "@/features/tasks/schemas/task.schema";

const PROJECT = "11111111-1111-4111-8111-111111111111";
const PARENT = "22222222-2222-4222-8222-222222222222";

describe("task schemas", () => {
  it("requires title on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "أ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts create with parentTaskId", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      parentTaskId: PARENT,
      title: "مهمة فرعية",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentTaskId).toBe(PARENT);
      expect(result.data.status).toBe("todo");
      expect(result.data.priority).toBe("medium");
    }
  });

  it("normalizes empty assignedTo to null", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      assignedTo: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.assignedTo).toBeNull();
    }
  });

  it("rejects empty update", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("parses parentTaskId=null for root tasks", () => {
    const result = listTasksQuerySchema.safeParse({
      parentTaskId: "null",
      pageSize: "25",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentTaskId).toBeNull();
    }
  });
});
