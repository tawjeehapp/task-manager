import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TasksPageClient } from "@/features/tasks/components/tasks-page-client";
import { listTasksQuerySchema } from "@/features/tasks/schemas/task.schema";
import { listTasksForViewer } from "@/features/tasks/services/tasks";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("tasks");
  const user = await getCurrentUser();
  return {
    title:
      user?.role === "employee" ? t("myTasksTitle") : t("title"),
  };
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

  const mineOnly = user.role === "employee";
  const defaultQuery = listTasksQuerySchema.parse({
    // Employees see assigned root tasks and subtasks; managers keep root-only list.
    ...(mineOnly
      ? { assignee: user.id, pageSize: 100, sortBy: "dueDate", sortDir: "asc" }
      : { parentTaskId: "null" }),
  });
  const initialTasks = await listTasksForViewer(user, defaultQuery);

  return (
    <TasksPageClient
      canCreate={canCreate}
      viewerRole={user.role}
      viewerId={user.id}
      initialTasks={initialTasks}
    />
  );
}
