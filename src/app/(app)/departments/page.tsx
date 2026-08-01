import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DepartmentsPageClient } from "@/features/departments/components/departments-page-client";
import { listDepartmentsQuerySchema } from "@/features/departments/schemas/department.schema";
import { listDepartmentsForViewer } from "@/features/departments/services/departments";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("departments");
  return { title: t("title") };
}

export default async function DepartmentsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Employees work only within assigned projects — no department list UI.
  if (user.role === "employee") {
    redirect("/");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.DEPARTMENT_VIEW, permissions)) {
    redirect("/");
  }

  const canManage = hasPermission(
    user.role,
    PERMISSIONS.DEPARTMENT_MANAGE,
    permissions,
  );

  const defaultQuery = listDepartmentsQuerySchema.parse({});
  const initialDepartments = await listDepartmentsForViewer(user, defaultQuery);

  return (
    <DepartmentsPageClient
      canManage={canManage}
      viewerRole={user.role}
      initialDepartments={initialDepartments}
    />
  );
}
