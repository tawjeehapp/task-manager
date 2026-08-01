import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  listTasksQuerySchema,
  updateTaskSchema,
} from "@/features/tasks/schemas/task.schema";

const PROJECT = "11111111-1111-4111-8111-111111111111";

describe("task schemas", () => {
  it("requires title on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "أ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts create with estimatedHours", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      estimatedHours: 4,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedHours).toBe(4);
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

  it("parses list query without hierarchy filters", () => {
    const result = listTasksQuerySchema.safeParse({
      projectId: PROJECT,
      pageSize: "25",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.projectId).toBe(PROJECT);
      expect(result.data.pageSize).toBe(25);
    }
  });
});
