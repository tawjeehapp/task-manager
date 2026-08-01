"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import type { ProjectWithStats } from "@/features/projects/types/project.types";
import type { EmployeeProjectsListResult } from "@/features/projects/services/projects";
import { filterProjectsBySearch } from "@/features/projects/lib/group-projects-by-department";
import { withInitialData } from "@/lib/query/initial-data";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Input } from "@/components/ui/input";

type EmployeeProjectsPageClientProps = {
  initialProjects: EmployeeProjectsListResult;
};

async function fetchEmployeeProjects(): Promise<EmployeeProjectsListResult> {
  const response = await fetch("/api/projects?includeStats=true");
  const payload = (await response.json()) as {
    data?: EmployeeProjectsListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

function ProgressBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  taskCountLabel,
  overdueLabel,
}: {
  project: ProjectWithStats;
  taskCountLabel: string;
  overdueLabel: string | null;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="space-y-1">
        <h3 className="font-semibold leading-snug text-foreground">
          {project.name}
        </h3>
        {project.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="mt-auto space-y-2 pt-1">
        <ProgressBar value={project.progressPercent} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="tabular-nums">
            {Math.round(project.progressPercent)}%
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span>{taskCountLabel}</span>
            {overdueLabel ? (
              <span className="font-medium text-destructive">{overdueLabel}</span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function EmployeeProjectsPageClient({
  initialProjects,
}: EmployeeProjectsPageClientProps) {
  const t = useTranslations("projects");
  const tCommon = useTranslations("common");
  const [search, setSearch] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects", "employee", "stats"],
    queryFn: fetchEmployeeProjects,
    ...withInitialData(initialProjects),
  });

  const projects = useMemo(
    () =>
      filterProjectsBySearch(projectsQuery.data?.items ?? [], search),
    [projectsQuery.data?.items, search],
  );

  if (projectsQuery.isLoading) {
    return <LoadingState />;
  }

  if (projectsQuery.isError) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={(projectsQuery.error as Error).message}
        onRetry={() => void projectsQuery.refetch()}
      />
    );
  }

  const total = projectsQuery.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={t("myDepartmentAndProjects")}
          description={t("employeeListHelper")}
        />
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchProjects")}
            className="ps-8"
          />
        </div>
      </div>

      {total === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("employeeDescription")}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("employeeDescription")}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              taskCountLabel={t("cardTaskCount", {
                count: project.taskCount,
              })}
              overdueLabel={
                project.overdueCount > 0
                  ? t("cardOverdueCount", {
                      count: project.overdueCount,
                    })
                  : null
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
