import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployeeDashboardClient } from "@/features/dashboard/components/employee-dashboard-client";
import { LeadershipDashboardView } from "@/features/dashboard/components/leadership-dashboard-view";
import {
  getDashboardSummary,
  getManagerDashboard,
  getPersonalDashboard,
} from "@/features/dashboard/services/dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("dashboard");
  const user = await getCurrentUser();
  if (user?.role === "department_manager") {
    return { title: t("leadershipTitleManager") };
  }
  return { title: t("title") };
}

export default async function DashboardPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Managers land on the department (leadership) dashboard first.
  if (user.role === "department_manager") {
    const [data, permissions] = await Promise.all([
      getManagerDashboard(user),
      getPermissionsForRole(user.role),
    ]);
    const canViewReports = hasPermission(
      user.role,
      PERMISSIONS.REPORT_VIEW,
      permissions,
    );
    return (
      <LeadershipDashboardView data={data} canViewReports={canViewReports} />
    );
  }

  if (user.role === "employee") {
    const data = await getPersonalDashboard(user);
    return (
      <EmployeeDashboardClient
        data={data}
        viewerId={user.id}
        viewerName={user.fullName}
      />
    );
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

  if (data.role !== "admin") {
    redirect("/");
  }

  return (
    <LeadershipDashboardView data={data} canViewReports={canViewReports} />
  );
}
