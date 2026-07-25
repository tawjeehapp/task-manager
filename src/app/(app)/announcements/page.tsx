import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnnouncementsPageClient } from "@/features/announcements/components/announcements-page-client";
import { getManagedDepartmentId } from "@/features/departments/services/membership-helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("announcements");
  return { title: t("title") };
}

export default async function AnnouncementsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.ANNOUNCEMENT_VIEW, permissions)) {
    redirect("/");
  }

  const canManage = hasPermission(
    user.role,
    PERMISSIONS.ANNOUNCEMENT_MANAGE,
    permissions,
  );

  const managedDepartmentId =
    user.role === "department_manager"
      ? await getManagedDepartmentId(user.id)
      : null;

  return (
    <AnnouncementsPageClient
      viewerRole={user.role}
      canManage={canManage}
      managedDepartmentId={managedDepartmentId}
    />
  );
}
