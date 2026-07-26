import type { DashboardSummary } from "@/features/dashboard/types/dashboard.types";
import { EmployeeDashboardClient } from "@/features/dashboard/components/employee-dashboard-client";
import { LeadershipDashboardView } from "@/features/dashboard/components/leadership-dashboard-view";

type DashboardPageViewProps = {
  data: DashboardSummary;
  canViewReports: boolean;
  viewerId: string;
  viewerName: string;
};

export async function DashboardPageView({
  data,
  canViewReports,
  viewerId,
  viewerName,
}: DashboardPageViewProps) {
  if (data.role === "employee") {
    return (
      <EmployeeDashboardClient
        data={data}
        viewerId={viewerId}
        viewerName={viewerName}
      />
    );
  }

  return (
    <LeadershipDashboardView data={data} canViewReports={canViewReports} />
  );
}
