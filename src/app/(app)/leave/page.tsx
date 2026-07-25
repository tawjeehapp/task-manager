import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LeavePageClient } from "@/features/leave/components/leave-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("leave");
  return { title: t("title") };
}

export default async function LeavePage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.LEAVE_VIEW, permissions)) {
    redirect("/");
  }

  const canManage = hasPermission(
    user.role,
    PERMISSIONS.LEAVE_MANAGE,
    permissions,
  );

  return (
    <LeavePageClient viewerRole={user.role} canManage={canManage} />
  );
}
