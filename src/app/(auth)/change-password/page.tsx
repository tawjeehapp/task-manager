import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthBrand } from "@/features/auth/components/auth-brand";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { routing } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("changePasswordTitle") };
}

export default async function ChangePasswordPage() {
  setRequestLocale(routing.defaultLocale);

  return (
    <>
      <AuthBrand />
      <ChangePasswordForm />
    </>
  );
}
