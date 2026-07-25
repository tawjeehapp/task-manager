import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TasksPageClient } from "@/features/tasks/components/tasks-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("tasks");
  return { title: t("title") };
}

export default async function TasksPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.PROJECT_VIEW, permissions)) {
    redirect("/");
  }

  const canCreate =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.TASK_CREATE, permissions);

  return (
    <TasksPageClient
      canCreate={canCreate}
      viewerRole={user.role}
      viewerId={user.id}
    />
  );
}
