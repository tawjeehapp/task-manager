"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { EmployeeAttendancePageClient } from "@/features/attendance/components/employee-attendance-page-client";
import { EmployeeLeavePageClient } from "@/features/leave/components/employee-leave-page-client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabPanel } from "@/components/shared/tabs";

type PersonalAttendanceLeavePageClientProps = {
  viewerId: string;
};

export function PersonalAttendanceLeavePageClient({
  viewerId,
}: PersonalAttendanceLeavePageClientProps) {
  const t = useTranslations("attendanceLeave");
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "leave" ? "leave" : "attendance";

  const setTab = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "attendance") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const qs = params.toString();
    router.replace(qs ? `/attendance?${qs}` : "/attendance");
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("employeeDescription")} />

      <Tabs
        items={[
          { id: "attendance", label: t("tabMyAttendance") },
          { id: "leave", label: t("tabMyLeave") },
        ]}
        value={tab}
        onValueChange={setTab}
      >
        <TabPanel when="attendance" active={tab}>
          <EmployeeAttendancePageClient viewerId={viewerId} embedded />
        </TabPanel>
        <TabPanel when="leave" active={tab}>
          <EmployeeLeavePageClient viewerId={viewerId} embedded />
        </TabPanel>
      </Tabs>
    </div>
  );
}
