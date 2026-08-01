import { describe, expect, it } from "vitest";

import {
  filterProjectsBySearch,
  groupProjectsByDepartment,
} from "@/features/projects/lib/group-projects-by-department";
import type { ProjectWithStats } from "@/features/projects/types/project.types";

function project(
  overrides: Partial<ProjectWithStats> &
    Pick<ProjectWithStats, "id" | "departmentId" | "name">,
): ProjectWithStats {
  return {
    department: {
      id: overrides.departmentId,
      name: overrides.department?.name ?? "Dept",
    },
    description: null,
    status: "active",
    priority: "medium",
    startDate: null,
    endDate: "2026-12-31",
    createdBy: "u1",
    createdByUser: null,
    memberCount: 1,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
    progressPercent: 0,
    taskCount: 0,
    completedTaskCount: 0,
    overdueCount: 0,
    departmentMemberCount: 2,
    ...overrides,
  };
}

describe("filterProjectsBySearch", () => {
  const items = [
    project({
      id: "p1",
      departmentId: "d1",
      name: "منهج العلوم",
      description: "تأليف وحدات",
    }),
    project({
      id: "p2",
      departmentId: "d1",
      name: "دليل الرياضيات",
      description: null,
      department: { id: "d1", name: "المناهج" },
    }),
  ];

  it("returns all when search is empty", () => {
    expect(filterProjectsBySearch(items, "  ")).toHaveLength(2);
  });

  it("matches name and description", () => {
    expect(filterProjectsBySearch(items, "علوم")).toHaveLength(1);
    expect(filterProjectsBySearch(items, "تأليف")).toHaveLength(1);
    expect(filterProjectsBySearch(items, "رياضيات")).toHaveLength(1);
  });
});

describe("groupProjectsByDepartment", () => {
  it("groups by department and preserves order", () => {
    const items = [
      project({
        id: "p1",
        departmentId: "d1",
        name: "A",
        department: { id: "d1", name: "Alpha" },
        departmentMemberCount: 3,
      }),
      project({
        id: "p2",
        departmentId: "d2",
        name: "B",
        department: { id: "d2", name: "Beta" },
        departmentMemberCount: 5,
      }),
      project({
        id: "p3",
        departmentId: "d1",
        name: "C",
        department: { id: "d1", name: "Alpha" },
        departmentMemberCount: 3,
      }),
    ];

    const groups = groupProjectsByDepartment(items);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      departmentId: "d1",
      departmentName: "Alpha",
      memberCount: 3,
    });
    expect(groups[0]!.projects.map((p) => p.id)).toEqual(["p1", "p3"]);
    expect(groups[1]!.departmentId).toBe("d2");
  });
});
