import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmployeesPageClient } from "@/features/users/components/employees-page-client";
import { listUsersQuerySchema } from "@/features/users/schemas/user.schema";
import { listUsersForViewer } from "@/features/users/services/get-users";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("employees");
  return { title: t("title") };
}

export default async function EmployeesPage() {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const permissions = await getPermissionsForRole(user.role);
  const canManage = hasPermission(
    user.role,
    PERMISSIONS.USER_MANAGE,
    permissions,
  );
  const canReset = hasPermission(
    user.role,
    PERMISSIONS.USER_RESET_PASSWORD,
    permissions,
  );

  if (!canManage && !canReset) {
    redirect("/");
  }

  const defaultQuery = listUsersQuerySchema.parse({});
  const initialUsers = await listUsersForViewer(user, defaultQuery, canManage);

  return (
    <EmployeesPageClient
      canManage={canManage}
      isAdmin={user.role === "admin"}
      currentUserId={user.id}
      initialUsers={initialUsers}
    />
  );
}
