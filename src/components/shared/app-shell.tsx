import type { ReactNode } from "react";

import { AppHeader } from "@/components/shared/app-header";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { MobileNav } from "@/components/shared/mobile-nav";
import { PushOptInBanner } from "@/features/notifications/components/push-opt-in-banner";
import type { AuthMeResponse } from "@/features/auth/types/auth.types";

type AppShellProps = {
  children: ReactNode;
  initialMe: AuthMeResponse;
};

export function AppShell({ children, initialMe }: AppShellProps) {
  return (
    <div className="flex min-h-full flex-col bg-background">
      <AppHeader initialMe={initialMe} />
      <PushOptInBanner />
      <div className="flex min-h-0 flex-1">
        <div className="hidden border-s border-border lg:block">
          <AppSidebar
            className="sticky top-16 h-[calc(100dvh-4rem)]"
            initialMe={initialMe}
          />
        </div>
        <main className="min-w-0 flex-1 px-4 py-6 pb-24 lg:px-6 lg:pb-6">
          {children}
        </main>
      </div>
      <MobileNav initialMe={initialMe} />
    </div>
  );
}
