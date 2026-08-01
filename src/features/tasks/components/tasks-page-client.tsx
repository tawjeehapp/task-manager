"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Columns3, List, Plus } from "lucide-react";

import {
  createTaskSchema,
  type CreateTaskInput,
  type TaskSortBy,
} from "@/features/tasks/schemas/task.schema";
import type { Task } from "@/features/tasks/types/task.types";
import type { TasksListResult } from "@/features/tasks/services/tasks";
import type { Project } from "@/features/projects/types/project.types";
import type { Role } from "@/lib/permissions";
import { withInitialData } from "@/lib/query/initial-data";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type SortDirection,
  type TablePageSize,
} from "@/lib/table/constants";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { TasksListTable } from "@/features/tasks/components/tasks-list-table";
import { EmployeeTasksBoard } from "@/features/tasks/components/employee-tasks-board";
import { TaskDependencyPicker } from "@/features/tasks/components/task-dependency-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type TasksPageClientProps = {
  canCreate: boolean;
  viewerRole: Role;
  viewerId: string;
  initialTasks: TasksListResult;
  /** When true, show the personal Kanban (employees + managers on /tasks). */
  personalBoard?: boolean;
};

async function fetchTasks(params: {
  page: number;
  pageSize: TablePageSize;
  sortBy: TaskSortBy;
  sortDir: SortDirection;
  status?: string;
  projectId?: string;
  departmentId?: string;
  assignee?: string;
  priority?: string;
  dueFrom?: string;
  dueTo?: string;
}): Promise<TasksListResult> {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.projectId) {
    searchParams.set("projectId", params.projectId);
  }
  if (params.departmentId) {
    searchParams.set("departmentId", params.departmentId);
  }
  if (params.assignee) {
    searchParams.set("assignee", params.assignee);
  }
  if (params.priority) {
    searchParams.set("priority", params.priority);
  }
  if (params.dueFrom) {
    searchParams.set("dueFrom", params.dueFrom);
  }
  if (params.dueTo) {
    searchParams.set("dueTo", params.dueTo);
  }
  const response = await fetch(`/api/tasks?${searchParams.toString()}`);
  const payload = (await response.json()) as {
    data?: TasksListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch("/api/projects?pageSize=100");
  const payload = (await response.json()) as {
    data?: { items: Project[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

type DepartmentOption = { id: string; name: string };
type UserOption = { id: string; fullName: string; employeeNumber: string };

async function fetchDepartments(): Promise<DepartmentOption[]> {
  const response = await fetch("/api/departments?pageSize=100");
  const payload = (await response.json()) as {
    data?: { items: DepartmentOption[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

async function fetchUsersForFilter(): Promise<UserOption[]> {
  const response = await fetch("/api/users?pageSize=100&isActive=true");
  const payload = (await response.json()) as {
    data?: { items: UserOption[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function TasksPageClient({
  canCreate,
  viewerRole,
  viewerId,
  initialTasks,
  personalBoard = false,
}: TasksPageClientProps) {
  if (personalBoard || viewerRole === "employee") {
    return (
      <EmployeeTasksBoard viewerId={viewerId} initialTasks={initialTasks} />
    );
  }

  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [sortBy] = useState<TaskSortBy>("createdAt");
  const [sortDir] = useState<SortDirection>("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const canFilterDepartment =
    viewerRole === "admin" || viewerRole === "department_manager";
  const canFilterAssignee =
    viewerRole === "admin" || viewerRole === "department_manager";

  const isDefaultTasksQuery =
    page === 1 &&
    pageSize === DEFAULT_TABLE_PAGE_SIZE &&
    sortBy === "createdAt" &&
    sortDir === "desc" &&
    statusFilter === "" &&
    projectFilter === "" &&
    departmentFilter === "" &&
    assigneeFilter === "" &&
    priorityFilter === "" &&
    dueFrom === "" &&
    dueTo === "" &&
    mineOnly === false;

  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      page,
      pageSize,
      sortBy,
      sortDir,
      statusFilter,
      projectFilter,
      departmentFilter,
      assigneeFilter,
      priorityFilter,
      dueFrom,
      dueTo,
      mineOnly,
    ],
    queryFn: () =>
      fetchTasks({
        page,
        pageSize,
        sortBy,
        sortDir,
        status: statusFilter || undefined,
        projectId: projectFilter || undefined,
        departmentId: departmentFilter || undefined,
        assignee: mineOnly ? viewerId : assigneeFilter || undefined,
        priority: priorityFilter || undefined,
        dueFrom: dueFrom || undefined,
        dueTo: dueTo || undefined,
      }),
    ...(isDefaultTasksQuery ? withInitialData(initialTasks) : {}),
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", "for-task-filters"],
    queryFn: fetchProjects,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "for-task-filters"],
    enabled: canFilterDepartment,
    queryFn: fetchDepartments,
  });

  const usersQuery = useQuery({
    queryKey: ["users", "for-task-filters"],
    enabled: canFilterAssignee,
    queryFn: fetchUsersForFilter,
  });

  const createForm = useForm<CreateTaskInput>({
    resolver: zodResolver(createTaskSchema) as never,
    defaultValues: {
      projectId: "",
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      assignedTo: null,
      startDate: null,
      dueDate: null,
      dependsOnTaskIds: [],
    },
  });

  const watchedProjectId = createForm.watch("projectId");
  const watchedDependsOn = createForm.watch("dependsOnTaskIds") ?? [];
  const selectedProjectEndDate =
    projectsQuery.data?.find((project) => project.id === watchedProjectId)
      ?.endDate ?? undefined;

  const createMutation = useMutation({
    mutationFn: async (values: CreateTaskInput) => {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        data?: Task;
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("createFailed"));
      }
      return payload.data!;
    },
    onSuccess: async () => {
      setCreateOpen(false);
      createForm.reset();
      setSuccessMessage(t("createSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const items = tasksQuery.data?.items ?? [];
  const total = tasksQuery.data?.total ?? 0;

  function statusLabel(status: string) {
    return t(`status_${status}` as "status_todo");
  }

  function priorityLabel(priority: string) {
    return t(`priority_${priority}` as "priority_low");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("teamTasksTitle")}
        description={t("teamTasksDescription")}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="inline-flex rounded-lg border border-border p-0.5"
              role="group"
              aria-label={t("viewMode")}
            >
              <Button
                type="button"
                size="sm"
                variant={viewMode === "list" ? "secondary" : "ghost"}
                className={cn("gap-1.5", viewMode === "list" && "shadow-sm")}
                onClick={() => setViewMode("list")}
              >
                <List className="size-3.5" />
                {t("listView")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "board" ? "secondary" : "ghost"}
                className={cn("gap-1.5", viewMode === "board" && "shadow-sm")}
                onClick={() => setViewMode("board")}
              >
                <Columns3 className="size-3.5" />
                {t("boardView")}
              </Button>
            </div>
            {canCreate ? (
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger
                  render={<Button type="button" className="gap-2" />}
                >
                  <Plus className="size-4" />
                  {t("create")}
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("createTitle")}</DialogTitle>
                  </DialogHeader>
                  <form
                    className="space-y-4"
                    onSubmit={createForm.handleSubmit((values) =>
                      createMutation.mutate({ ...values, startDate: null }),
                    )}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="projectId">{t("project")}</Label>
                      <select
                        id="projectId"
                        className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                        {...createForm.register("projectId")}
                      >
                        <option value="">{t("selectProject")}</option>
                        {(projectsQuery.data ?? [])
                          .filter((p) => p.status !== "archived")
                          .map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="title">{t("titleLabel")}</Label>
                      <Input id="title" {...createForm.register("title")} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">
                        {t("descriptionLabel")}
                      </Label>
                      <textarea
                        id="description"
                        className="border-input bg-background min-h-20 w-full rounded-md border px-3 py-2 text-sm"
                        {...createForm.register("description")}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="priority">{t("priority")}</Label>
                        <select
                          id="priority"
                          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                          {...createForm.register("priority")}
                        >
                          <option value="low">{priorityLabel("low")}</option>
                          <option value="medium">
                            {priorityLabel("medium")}
                          </option>
                          <option value="high">{priorityLabel("high")}</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">{t("status")}</Label>
                        <select
                          id="status"
                          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
                          {...createForm.register("status")}
                        >
                          <option value="todo">{statusLabel("todo")}</option>
                          <option value="in_progress">
                            {statusLabel("in_progress")}
                          </option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dueDate">{t("dueDate")}</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          max={selectedProjectEndDate}
                          {...createForm.register("dueDate")}
                        />
                        {selectedProjectEndDate ? (
                          <p className="text-xs text-muted-foreground">
                            {t("dueDateWithinProjectHint", {
                              date: selectedProjectEndDate,
                            })}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="estimatedHours">
                          {t("estimatedHours")}
                        </Label>
                        <Input
                          id="estimatedHours"
                          type="number"
                          step="0.5"
                          min="0.5"
                          required
                          {...createForm.register("estimatedHours", {
                            setValueAs: (value) =>
                              value === "" || value == null
                                ? undefined
                                : Number(value),
                          })}
                        />
                        {createForm.formState.errors.estimatedHours ? (
                          <p className="text-destructive text-sm">
                            {createForm.formState.errors.estimatedHours.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <TaskDependencyPicker
                      projectId={watchedProjectId || null}
                      value={watchedDependsOn}
                      onChange={(ids) =>
                        createForm.setValue("dependsOnTaskIds", ids)
                      }
                    />
                    {createMutation.isError ? (
                      <Alert variant="destructive">
                        <AlertDescription>
                          {(createMutation.error as Error).message}
                        </AlertDescription>
                      </Alert>
                    ) : null}
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateOpen(false)}
                      >
                        {tCommon("cancel")}
                      </Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending
                          ? tCommon("saving")
                          : tCommon("save")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : null}
          </div>
        }
      />

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      {viewMode === "board" ? (
        <EmployeeTasksBoard
          viewerId={viewerId}
          initialTasks={initialTasks}
          mode="team"
          hideHeader
        />
      ) : (
        <>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(event) => {
              setMineOnly(event.target.checked);
              if (event.target.checked) {
                setAssigneeFilter("");
              }
              setPage(1);
            }}
          />
          {t("mineOnly")}
        </label>
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("filterAllStatuses")}</option>
          {(
            ["todo", "in_progress", "blocked", "completed"] as const
          ).map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={priorityFilter}
          onChange={(event) => {
            setPriorityFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("filterAllPriorities")}</option>
          {(["low", "medium", "high"] as const).map((priority) => (
            <option key={priority} value={priority}>
              {priorityLabel(priority)}
            </option>
          ))}
        </select>
        {canFilterDepartment ? (
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={departmentFilter}
            onChange={(event) => {
              setDepartmentFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("filterAllDepartments")}</option>
            {(departmentsQuery.data ?? []).map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
          value={projectFilter}
          onChange={(event) => {
            setProjectFilter(event.target.value);
            setPage(1);
          }}
        >
          <option value="">{t("filterAllProjects")}</option>
          {(projectsQuery.data ?? [])
            .filter(
              (project) =>
                !departmentFilter || project.departmentId === departmentFilter,
            )
            .map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
        </select>
        {canFilterAssignee && !mineOnly ? (
          <select
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            value={assigneeFilter}
            onChange={(event) => {
              setAssigneeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("filterAllAssignees")}</option>
            {(usersQuery.data ?? []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName}
              </option>
            ))}
          </select>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {t("dueFrom")}
          </span>
          <Input
            type="date"
            className="h-9 w-auto"
            value={dueFrom}
            onChange={(event) => {
              setDueFrom(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground whitespace-nowrap">
            {t("dueTo")}
          </span>
          <Input
            type="date"
            className="h-9 w-auto"
            value={dueTo}
            onChange={(event) => {
              setDueTo(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {tasksQuery.isLoading ? <LoadingState /> : null}
      {tasksQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={(tasksQuery.error as Error).message}
          onRetry={() => void tasksQuery.refetch()}
        />
      ) : null}

      {tasksQuery.isSuccess && items.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : null}

      {tasksQuery.isSuccess && items.length > 0 ? (
        <>
          <p className="text-muted-foreground text-sm">
            {t("totalCount", { count: total })}
          </p>
          <TasksListTable
            tasks={items}
            canEdit={canCreate}
            viewerId={viewerId}
            showProject
          />
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </>
      ) : null}
        </>
      )}
    </div>
  );
}
