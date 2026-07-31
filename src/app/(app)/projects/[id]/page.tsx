import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectDetailClient } from "@/features/projects/components/project-detail-client";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations("projects");
  return { title: t("detailsTitle") };
}

export default async function ProjectDetailPage({ params }: PageProps) {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.PROJECT_VIEW, permissions)) {
    redirect("/");
  }

  const { id } = await params;

  const canManageProject =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.PROJECT_MANAGE, permissions);

  const managedDepartmentId =
    user.role === "department_manager"
      ? await getManagedDepartmentId(user.id)
      : null;

  // Members / in-project ops: admin or manager (scoped further by API to their department).
  const canManageMembers =
    canManageProject || user.role === "department_manager";

  const canCreateTask =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.TASK_CREATE, permissions);

  return (
    <ProjectDetailClient
      projectId={id}
      canManageProject={canManageProject}
      canManageMembers={canManageMembers}
      canCreateTask={canCreateTask}
      managedDepartmentId={managedDepartmentId}
      viewerId={user.id}
      isEmployee={user.role === "employee"}
    />
  );
}
