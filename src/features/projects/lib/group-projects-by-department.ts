import type { ProjectWithStats } from "@/features/projects/types/project.types";

export type DepartmentProjectGroup = {
  departmentId: string;
  departmentName: string;
  memberCount: number;
  projects: ProjectWithStats[];
};

export function filterProjectsBySearch(
  projects: ProjectWithStats[],
  search: string,
): ProjectWithStats[] {
  const q = search.trim().toLowerCase();
  if (!q) return projects;
  return projects.filter((project) => {
    const hay =
      `${project.name} ${project.description ?? ""} ${project.department?.name ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}

/** Groups projects by department; preserves first-seen department order. */
export function groupProjectsByDepartment(
  projects: ProjectWithStats[],
): DepartmentProjectGroup[] {
  const groups = new Map<string, DepartmentProjectGroup>();
  const order: string[] = [];

  for (const project of projects) {
    const departmentId = project.departmentId;
    const existing = groups.get(departmentId);
    if (existing) {
      existing.projects.push(project);
      continue;
    }
    order.push(departmentId);
    groups.set(departmentId, {
      departmentId,
      departmentName: project.department?.name ?? departmentId,
      memberCount: project.departmentMemberCount,
      projects: [project],
    });
  }

  return order.map((id) => groups.get(id)!);
}
