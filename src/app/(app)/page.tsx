import { getTranslations, setRequestLocale } from "next-intl/server";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { routing } from "@/i18n/routing";

export default async function DashboardPage() {
  setRequestLocale(routing.defaultLocale);
  const t = await getTranslations("dashboard");

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
    </div>
  );
}
