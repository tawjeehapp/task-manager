import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TaskDetailClient } from "@/features/tasks/components/task-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations("tasks");
  return { title: t("detailsTitle") };
}

export default async function TaskDetailPage({ params }: PageProps) {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  // Access is further scoped in the service layer
  if (
    !hasPermission(user.role, PERMISSIONS.PROJECT_VIEW, permissions) &&
    user.role === "employee"
  ) {
    // employees may still open assigned tasks via assertCanAccessTask
  }

  const { id } = await params;
  const canAssign =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.TASK_ASSIGN, permissions);
  const canCreate =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.TASK_CREATE, permissions);

  return (
    <TaskDetailClient
      taskId={id}
      canAssign={canAssign}
      canCreate={canCreate}
      viewerId={user.id}
    />
  );
}
