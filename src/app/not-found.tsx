import { setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

export default function NotFound() {
  setRequestLocale(routing.defaultLocale);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-4 text-center">
      <h1 className="text-2xl font-semibold">404</h1>
      <p className="text-sm text-muted-foreground">الصفحة غير موجودة</p>
    </div>
  );
}
