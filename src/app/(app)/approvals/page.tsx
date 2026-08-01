import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApprovalsPageClient } from "@/features/approvals/components/approvals-page-client";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("approvals");
  return { title: t("title") };
}

export default async function ApprovalsPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  const canApproveLeave = hasPermission(
    user.role,
    PERMISSIONS.LEAVE_APPROVE,
    permissions,
  );
  const canApproveEmployeeRequest = hasPermission(
    user.role,
    PERMISSIONS.EMPLOYEE_REQUEST_APPROVE,
    permissions,
  );
  const canApproveAttendance = hasPermission(
    user.role,
    PERMISSIONS.ATTENDANCE_APPROVE,
    permissions,
  );
  const canApproveProjectRequest = hasPermission(
    user.role,
    PERMISSIONS.PROJECT_REQUEST_APPROVE,
    permissions,
  );

  if (
    !canApproveLeave &&
    !canApproveEmployeeRequest &&
    !canApproveAttendance &&
    !canApproveProjectRequest
  ) {
    redirect("/");
  }

  return (
    <ApprovalsPageClient
      viewerId={user.id}
      canApproveLeave={canApproveLeave}
      canApproveEmployeeRequest={canApproveEmployeeRequest}
      canApproveAttendance={canApproveAttendance}
      canApproveProjectRequest={canApproveProjectRequest}
    />
  );
}
