import { describe, expect, it } from "vitest";

import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from "@/features/projects/schemas/project.schema";

const DEPT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

describe("project schemas", () => {
  it("requires project name on create", () => {
    const result = createProjectSchema.safeParse({
      departmentId: DEPT,
      name: "أ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid create payload with defaults", () => {
    const result = createProjectSchema.safeParse({
      departmentId: DEPT,
      name: "مشروع المناهج",
      description: "",
      memberIds: [USER],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.status).toBe("draft");
      expect(result.data.priority).toBe("medium");
      expect(result.data.memberIds).toEqual([USER]);
    }
  });

  it("rejects empty update", () => {
    const result = updateProjectSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts archive status update", () => {
    const result = updateProjectSchema.safeParse({ status: "archived" });
    expect(result.success).toBe(true);
  });

  it("validates list query page sizes", () => {
    const ok = listProjectsQuerySchema.safeParse({ pageSize: "50" });
    expect(ok.success).toBe(true);
    const bad = listProjectsQuerySchema.safeParse({ pageSize: "10" });
    expect(bad.success).toBe(false);
  });
});
