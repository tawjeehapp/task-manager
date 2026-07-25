import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ProjectGanttClient } from "@/features/gantt/components/project-gantt-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations("gantt");
  return { title: t("title") };
}

export default async function ProjectGanttPage({ params }: PageProps) {
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

  return <ProjectGanttClient projectId={id} />;
}
