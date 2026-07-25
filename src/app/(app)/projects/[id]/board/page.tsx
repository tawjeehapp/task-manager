import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectBoardClient } from "@/features/projects/components/project-board-client";
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
  return { title: t("kanban") };
}

export default async function ProjectBoardPage({ params }: PageProps) {
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
  const canUpdateStatus =
    user.role === "admin" ||
    user.role === "department_manager" ||
    hasPermission(user.role, PERMISSIONS.TASK_ASSIGN, permissions) ||
    user.role === "employee";

  return (
    <ProjectBoardClient projectId={id} canUpdateStatus={canUpdateStatus} />
  );
}
