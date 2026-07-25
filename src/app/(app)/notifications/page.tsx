import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { NotificationsPageClient } from "@/features/notifications/components/notifications-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function NotificationsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.NOTIFICATION_VIEW, permissions)) {
    redirect("/");
  }

  return <NotificationsPageClient />;
}
