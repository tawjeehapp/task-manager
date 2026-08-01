import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ManagerAttendanceLeavePageClient } from "@/features/attendance/components/manager-attendance-leave-page-client";
import { PersonalAttendanceLeavePageClient } from "@/features/attendance/components/personal-attendance-leave-page-client";
import { LoadingState } from "@/components/shared/loading-state";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("attendanceLeave");
  return { title: t("title") };
}

export default async function AttendancePage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  if (!hasPermission(user.role, PERMISSIONS.ATTENDANCE_VIEW, permissions)) {
    redirect("/");
  }

  if (user.role === "employee") {
    return (
      <Suspense fallback={<LoadingState />}>
        <PersonalAttendanceLeavePageClient viewerId={user.id} />
      </Suspense>
    );
  }

  const canApproveAttendance = hasPermission(
    user.role,
    PERMISSIONS.ATTENDANCE_APPROVE,
    permissions,
  );
  const canApproveLeave = hasPermission(
    user.role,
    PERMISSIONS.LEAVE_APPROVE,
    permissions,
  );

  return (
    <Suspense fallback={<LoadingState />}>
      <ManagerAttendanceLeavePageClient
        viewerId={user.id}
        viewerRole={user.role}
        canApproveAttendance={canApproveAttendance}
        canApproveLeave={canApproveLeave}
      />
    </Suspense>
  );
}
