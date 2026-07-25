import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ReportsPageClient } from "@/features/reports/components/reports-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { currentMonthBounds, todayInOrgTimezone } from "@/lib/org-calendar";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default async function ReportsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.REPORT_VIEW, permissions)) {
    redirect("/");
  }

  const bounds = currentMonthBounds(todayInOrgTimezone());

  return (
    <ReportsPageClient
      viewerRole={user.role}
      defaultDateFrom={bounds.start}
      defaultDateTo={bounds.end}
    />
  );
}
