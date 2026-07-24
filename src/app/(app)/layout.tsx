import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { AppShell } from "@/components/shared/app-shell";
import { routing } from "@/i18n/routing";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  setRequestLocale(routing.defaultLocale);
  return <AppShell>{children}</AppShell>;
}
