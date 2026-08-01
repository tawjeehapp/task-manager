import { describe, expect, it } from "vitest";

import {
  createDepartmentSchema,
  moveDepartmentMemberSchema,
  updateDepartmentSchema,
} from "@/features/departments/schemas/department.schema";

const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

describe("department schemas", () => {
  it("requires department name on create", () => {
    const result = createDepartmentSchema.safeParse({
      name: "أ",
      managerId: UUID_A,
    });
    expect(result.success).toBe(false);
  });

  it("requires managerId on create", () => {
    const result = createDepartmentSchema.safeParse({
      name: "المناهج",
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty managerId on create", () => {
    const result = createDepartmentSchema.safeParse({
      name: "المناهج",
      managerId: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid create payload", () => {
    const result = createDepartmentSchema.safeParse({
      name: "المناهج",
      description: "",
      managerId: UUID_A,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.description).toBeNull();
      expect(result.data.managerId).toBe(UUID_A);
    }
  });

  it("rejects null managerId on update (replace-only)", () => {
    const result = updateDepartmentSchema.safeParse({
      managerId: null,
    });
    expect(result.success).toBe(false);
  });

  it("requires replaceExistingManager optional on update with managerId", () => {
    const result = updateDepartmentSchema.safeParse({
      managerId: UUID_A,
      replaceExistingManager: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty update", () => {
    const result = updateDepartmentSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("validates move membership payload", () => {
    const result = moveDepartmentMemberSchema.safeParse({
      userId: UUID_A,
      toDepartmentId: UUID_B,
    });
    expect(result.success).toBe(true);
  });
});
