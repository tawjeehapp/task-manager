import type { ReactNode } from "react";

import { AppHeader } from "@/components/shared/app-header";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <AppHeader />
      <div className="flex min-h-0 flex-1">
        <div className="hidden border-s border-border lg:block">
          <AppSidebar className="sticky top-16 h-[calc(100dvh-4rem)]" />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
