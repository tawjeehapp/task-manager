import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectsPageClient } from "@/features/projects/components/projects-page-client";
import { listProjectsQuerySchema } from "@/features/projects/schemas/project.schema";
import { listProjectsForViewer } from "@/features/projects/services/projects";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("projects");
  return { title: t("title") };
}

export default async function ProjectsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.PROJECT_VIEW, permissions)) {
    redirect("/");
  }

  // Only admins create/edit/archive project entities.
  const canManage =
    user.role === "admin" ||
    hasPermission(user.role, PERMISSIONS.PROJECT_MANAGE, permissions);

  const defaultQuery = listProjectsQuerySchema.parse({});
  const initialProjects = await listProjectsForViewer(user, defaultQuery);

  return (
    <ProjectsPageClient
      canManage={canManage}
      viewerRole={user.role}
      initialProjects={initialProjects}
    />
  );
}
