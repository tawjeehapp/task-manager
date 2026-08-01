import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { AppShell } from "@/components/shared/app-shell";
import { getMe } from "@/features/auth/services/get-me";
import { getCurrentUser } from "@/lib/auth/session";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

type AppLayoutProps = {
  children: ReactNode;
};

export default async function AppLayout({ children }: AppLayoutProps) {
  setRequestLocale(routing.defaultLocale);

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  const initialMe = await getMe(user);

  return <AppShell initialMe={initialMe}>{children}</AppShell>;
}
