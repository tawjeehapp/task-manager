import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployeeDashboardClient } from "@/features/dashboard/components/employee-dashboard-client";
import { getPersonalDashboard } from "@/features/dashboard/services/dashboard";
import { getCurrentUser } from "@/lib/auth/session";
import { isPersonalWorkspaceRole } from "@/lib/permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("nav");
  return { title: t("myDashboard") };
}

export default async function MyDashboardPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (!isPersonalWorkspaceRole(user.role)) {
    redirect("/");
  }

  // Employees already have personal home at `/`.
  if (user.role === "employee") {
    redirect("/");
  }

  const data = await getPersonalDashboard(user);
  return (
    <EmployeeDashboardClient
      data={data}
      viewerId={user.id}
      viewerName={user.fullName}
    />
  );
}
