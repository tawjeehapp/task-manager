import { describe, expect, it } from "vitest";

import { isPersonalWorkspaceRole } from "@/lib/permissions/is-personal-workspace-role";

describe("isPersonalWorkspaceRole", () => {
  it("is true for employee and department_manager", () => {
    expect(isPersonalWorkspaceRole("employee")).toBe(true);
    expect(isPersonalWorkspaceRole("department_manager")).toBe(true);
  });

  it("is false for admin and nullish", () => {
    expect(isPersonalWorkspaceRole("admin")).toBe(false);
    expect(isPersonalWorkspaceRole(null)).toBe(false);
    expect(isPersonalWorkspaceRole(undefined)).toBe(false);
  });
});
