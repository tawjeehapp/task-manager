import { getTranslations, setRequestLocale } from "next-intl/server";

import { AuthBrand } from "@/features/auth/components/auth-brand";
import { LoginForm } from "@/features/auth/components/login-form";
import { routing } from "@/i18n/routing";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage() {
  setRequestLocale(routing.defaultLocale);

  return (
    <>
      <AuthBrand />
      <LoginForm />
    </>
  );
}
