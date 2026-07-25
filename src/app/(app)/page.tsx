import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DashboardPageView } from "@/features/dashboard/components/dashboard-page";
import { getDashboardSummary } from "@/features/dashboard/services/dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const [data, permissions] = await Promise.all([
    getDashboardSummary(user),
    getPermissionsForRole(user.role),
  ]);

  const canViewReports = hasPermission(
    user.role,
    PERMISSIONS.REPORT_VIEW,
    permissions,
  );

  return <DashboardPageView data={data} canViewReports={canViewReports} />;
}
