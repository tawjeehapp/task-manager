import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/** Leave is now part of the Attendance & vacations hub at `/attendance`. */
export default async function LeaveRedirectPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  if (user.role === "department_manager") {
    redirect("/attendance?tab=mine");
  }
  if (user.role === "employee") {
    redirect("/attendance?tab=leave");
  }
  redirect("/attendance");
}
