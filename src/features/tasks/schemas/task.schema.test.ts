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
      estimatedHours: 1,
    });
    expect(result.success).toBe(false);
  });

  it("requires estimatedHours on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive estimatedHours on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      estimatedHours: 0,
    });
    expect(result.success).toBe(false);
  });

  it("requires assignedTo on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      estimatedHours: 4,
    });
    expect(result.success).toBe(false);
  });

  it("accepts create with estimatedHours and assignee", () => {
    const assignee = "22222222-2222-4222-8222-222222222222";
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      estimatedHours: 4,
      assignedTo: assignee,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.estimatedHours).toBe(4);
      expect(result.data.assignedTo).toBe(assignee);
      expect(result.data.status).toBe("todo");
      expect(result.data.priority).toBe("medium");
    }
  });

  it("rejects empty assignedTo on create", () => {
    const result = createTaskSchema.safeParse({
      projectId: PROJECT,
      title: "مهمة",
      estimatedHours: 2,
      assignedTo: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects null assignedTo on update", () => {
    const result = updateTaskSchema.safeParse({ assignedTo: null });
    expect(result.success).toBe(false);
  });

  it("rejects empty update", () => {
    const result = updateTaskSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects null estimatedHours on update", () => {
    const result = updateTaskSchema.safeParse({ estimatedHours: null });
    expect(result.success).toBe(false);
  });

  it("accepts positive estimatedHours on update", () => {
    const result = updateTaskSchema.safeParse({ estimatedHours: 1.5 });
    expect(result.success).toBe(true);
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
