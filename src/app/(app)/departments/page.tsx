import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DepartmentsPageClient } from "@/features/departments/components/departments-page-client";
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

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.DEPARTMENT_VIEW, permissions)) {
    redirect("/");
  }

  const canManage = hasPermission(
    user.role,
    PERMISSIONS.DEPARTMENT_MANAGE,
    permissions,
  );

  return (
    <DepartmentsPageClient
      canManage={canManage}
      viewerRole={user.role}
    />
  );
}
