import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  setRequestLocale(routing.defaultLocale);

  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-accent-surface px-4 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {children}
      </div>
    </div>
  );
}
