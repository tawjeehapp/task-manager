import Image from "next/image";
import { getTranslations } from "next-intl/server";

/**
 * Auth brand stack: logo → company name → app name.
 */
export async function AuthBrand() {
  const t = await getTranslations("app");

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
      <Image
        src="/brand/logo.png"
        alt={t("companyName")}
        width={160}
        height={160}
        priority
        className="h-auto w-36 object-contain"
      />

      <div className="space-y-2">
        <p className="text-base font-medium tracking-wide text-primary-hover">
          {t("companyName")}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
          {t("name")}
        </h1>
      </div>
    </div>
  );
}
