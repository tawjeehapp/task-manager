import { getRequestConfig } from "next-intl/server";

import { routing, type AppLocale } from "./routing";

export default getRequestConfig(async () => {
  const locale: AppLocale = routing.defaultLocale;

  return {
    locale,
    // Explicit timezone avoids ENVIRONMENT_FALLBACK during static generation.
    timeZone: "Asia/Riyadh",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
