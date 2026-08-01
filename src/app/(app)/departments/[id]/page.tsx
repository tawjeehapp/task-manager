import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DepartmentDetailClient } from "@/features/departments/components/department-detail-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata() {
  const t = await getTranslations("departments");
  return { title: t("detailsTitle") };
}

export default async function DepartmentDetailPage({ params }: PageProps) {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Employees work only within assigned projects — no department detail UI.
  if (user.role === "employee") {
    redirect("/");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.DEPARTMENT_VIEW, permissions)) {
    redirect("/");
  }

  const { id } = await params;
  const canManage = hasPermission(
    user.role,
    PERMISSIONS.DEPARTMENT_MANAGE,
    permissions,
  );
  const canViewEmployeeProfiles =
    hasPermission(user.role, PERMISSIONS.USER_MANAGE, permissions) ||
    hasPermission(user.role, PERMISSIONS.USER_RESET_PASSWORD, permissions);

  return (
    <DepartmentDetailClient
      departmentId={id}
      canManage={canManage}
      canViewEmployeeProfiles={canViewEmployeeProfiles}
    />
  );
}
