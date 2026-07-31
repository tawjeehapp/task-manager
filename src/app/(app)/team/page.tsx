import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Legacy `/team` route — department dashboard is now `/`. */
export default async function TeamDashboardRedirectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  redirect("/");
}
