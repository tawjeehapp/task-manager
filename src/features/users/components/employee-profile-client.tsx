"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";

import {
  updateUserSchema,
  type UpdateUserInput,
} from "@/features/users/schemas/user.schema";
import type { Department } from "@/features/departments/types/department.types";
import type { UserListItem } from "@/features/users/types/user.types";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

type EmployeeProfileClientProps = {
  userId: string;
  canManage: boolean;
  currentUserId: string;
};

async function fetchUser(id: string): Promise<UserListItem> {
  const response = await fetch(`/api/users/${id}`);
  const payload = (await response.json()) as {
    data?: UserListItem;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!;
}

async function fetchDepartments(): Promise<Department[]> {
  const response = await fetch("/api/departments");
  const payload = (await response.json()) as {
    data?: { items: Department[] };
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed");
  }
  return payload.data!.items;
}

export function EmployeeProfileClient({
  userId,
  canManage,
  currentUserId,
}: EmployeeProfileClientProps) {
  const t = useTranslations("employees");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const isSelf = userId === currentUserId;

  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    "delete" | "reset" | "deactivate" | "activate" | "removeDepartment" | null
  >(null);

  const userQuery = useQuery({
    queryKey: ["users", userId],
    queryFn: () => fetchUser(userId),
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "active"],
    queryFn: fetchDepartments,
    enabled: canManage && membershipOpen,
  });

  const user = userQuery.data;

  const editForm = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as never,
    values: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      role: user?.role ?? "employee",
    },
  });

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("updateFailed"));
      }
    },
    onSuccess: async () => {
      setConfirmAction(null);
      setEditOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("deleteFailed"));
      }
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("resetFailed"));
      }
    },
    onSuccess: async () => {
      setConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ["users", userId] });
    },
  });

  const membershipMutation = useMutation({
    mutationFn: async ({
      departmentId,
      mode,
    }: {
      departmentId?: string;
      mode: "assign" | "move" | "remove";
    }) => {
      if (!user) {
        throw new Error(t("membershipFailed"));
      }
      if (mode === "remove") {
        if (!user.currentDepartment) {
          throw new Error(t("membershipFailed"));
        }
        const response = await fetch(
          `/api/departments/${user.currentDepartment.id}/members/${user.id}`,
          { method: "DELETE" },
        );
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? t("membershipFailed"));
        }
        return mode;
      }
      if (!departmentId) {
        throw new Error(t("membershipFailed"));
      }
      if (user.currentDepartment) {
        const response = await fetch("/api/departments/members/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            toDepartmentId: departmentId,
          }),
        });
        const payload = (await response.json()) as {
          error?: { message: string };
        };
        if (!response.ok) {
          throw new Error(payload.error?.message ?? t("membershipFailed"));
        }
        return "move" as const;
      }
      const response = await fetch(`/api/departments/${departmentId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("membershipFailed"));
      }
      return "assign" as const;
    },
    onSuccess: async (mode) => {
      setMembershipOpen(false);
      setConfirmAction(null);
      setSelectedDepartmentId("");
      if (!user) {
        return;
      }
      if (mode === "remove") {
        setSuccessMessage(
          t("removeDepartmentSuccess", { name: user.fullName }),
        );
      } else if (mode === "move") {
        setSuccessMessage(t("moveDepartmentSuccess", { name: user.fullName }));
      } else {
        setSuccessMessage(
          t("assignDepartmentSuccess", { name: user.fullName }),
        );
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
  });

  async function runConfirmAction() {
    if (!confirmAction || !user) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    try {
      if (confirmAction === "delete") {
        await deleteMutation.mutateAsync();
        setSuccessMessage(t("deleteSuccess", { name: user.fullName }));
        router.push("/employees");
        return;
      }
      if (confirmAction === "reset") {
        await resetMutation.mutateAsync();
        setSuccessMessage(
          t("resetSuccess", {
            name: user.fullName,
            employeeNumber: user.employeeNumber,
          }),
        );
        return;
      }
      if (confirmAction === "deactivate") {
        await patchMutation.mutateAsync({ isActive: false });
        setSuccessMessage(t("deactivateSuccess", { name: user.fullName }));
        return;
      }
      if (confirmAction === "activate") {
        await patchMutation.mutateAsync({ isActive: true });
        setSuccessMessage(t("activateSuccess", { name: user.fullName }));
        return;
      }
      if (confirmAction === "removeDepartment") {
        await membershipMutation.mutateAsync({ mode: "remove" });
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : tCommon("unexpectedError"),
      );
    }
  }

  if (userQuery.isLoading) {
    return <LoadingState />;
  }

  if (userQuery.isError || !user) {
    return (
      <ErrorState
        title={tCommon("errorTitle")}
        description={
          userQuery.error instanceof Error
            ? userQuery.error.message
            : undefined
        }
        onRetry={() => userQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/employees"
          className="mb-2 inline-flex h-7 items-center rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {t("backToList")}
        </Link>
        <PageHeader
          title={user.fullName}
          description={t("profileDescription", {
            employeeNumber: user.employeeNumber,
          })}
          actions={
            <div className="flex flex-wrap gap-2">
              {canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                >
                  {t("edit")}
                </Button>
              ) : null}
              {canManage && !isSelf ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfirmAction(user.isActive ? "deactivate" : "activate")
                  }
                >
                  {user.isActive ? t("deactivate") : t("activate")}
                </Button>
              ) : null}
              {!isSelf ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmAction("reset")}
                >
                  {t("resetPassword")}
                </Button>
              ) : null}
              {canManage ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedDepartmentId(user.currentDepartment?.id ?? "");
                      setMembershipOpen(true);
                    }}
                  >
                    {user.currentDepartment
                      ? t("moveDepartment")
                      : t("assignDepartment")}
                  </Button>
                  {user.currentDepartment ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setConfirmAction("removeDepartment")}
                    >
                      {t("removeDepartment")}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {canManage && !isSelf ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setConfirmAction("delete")}
                >
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          }
        />
      </div>

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("employeeNumber")}</p>
          <p className="mt-1 font-medium">{user.employeeNumber}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("role")}</p>
          <p className="mt-1 font-medium">{tRoles(user.role)}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("status")}</p>
          <Badge
            className="mt-1"
            variant={user.isActive ? "default" : "secondary"}
          >
            {user.isActive ? t("active") : t("inactive")}
          </Badge>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("phone")}</p>
          <p className="mt-1 font-medium">{user.phone ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-border p-4">
          <p className="text-sm text-muted-foreground">{t("department")}</p>
          <p className="mt-1 font-medium">
            {user.currentDepartment?.name ?? t("noDepartment")}
          </p>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editTitle")}</DialogTitle>
            <DialogDescription>
              {t("editDescription", { name: user.fullName })}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={editForm.handleSubmit(async (values) => {
              try {
                setSuccessMessage(null);
                const body: Record<string, unknown> = {
                  fullName: values.fullName,
                  phone: values.phone,
                };
                if (!isSelf) {
                  body.role = values.role;
                }
                await patchMutation.mutateAsync(body);
                setSuccessMessage(
                  t("updateSuccess", { name: user.fullName }),
                );
              } catch (error) {
                editForm.setError("root", {
                  message:
                    error instanceof Error ? error.message : t("updateFailed"),
                });
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="edit-fullName">{t("fullName")}</Label>
              <Input id="edit-fullName" {...editForm.register("fullName")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t("phone")}</Label>
              <Input
                id="edit-phone"
                inputMode="numeric"
                maxLength={10}
                {...editForm.register("phone")}
              />
            </div>
            {!isSelf ? (
              <div className="space-y-2">
                <Label htmlFor="edit-role">{t("role")}</Label>
                <select
                  id="edit-role"
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  {...editForm.register("role")}
                >
                  <option value="employee">{tRoles("employee")}</option>
                  <option value="department_manager">
                    {tRoles("department_manager")}
                  </option>
                  <option value="admin">{tRoles("admin")}</option>
                </select>
              </div>
            ) : null}
            {editForm.formState.errors.root ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {editForm.formState.errors.root.message}
                </AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={patchMutation.isPending}>
                {tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={membershipOpen} onOpenChange={setMembershipOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("membershipDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="department">{t("selectDepartment")}</Label>
              <select
                id="department"
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={selectedDepartmentId}
                onChange={(event) =>
                  setSelectedDepartmentId(event.target.value)
                }
              >
                <option value="">{t("selectDepartment")}</option>
                {(departmentsQuery.data ?? []).map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            {actionError ? (
              <Alert variant="destructive">
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            ) : null}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMembershipOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button
                type="button"
                disabled={
                  !selectedDepartmentId || membershipMutation.isPending
                }
                onClick={async () => {
                  try {
                    setActionError(null);
                    setSuccessMessage(null);
                    await membershipMutation.mutateAsync({
                      departmentId: selectedDepartmentId,
                      mode: user.currentDepartment ? "move" : "assign",
                    });
                  } catch (error) {
                    setActionError(
                      error instanceof Error
                        ? error.message
                        : tCommon("unexpectedError"),
                    );
                  }
                }}
              >
                {tCommon("confirm")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmAction(null);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "delete"
                ? t("confirmDeleteTitle")
                : confirmAction === "reset"
                  ? t("confirmResetTitle")
                  : confirmAction === "deactivate"
                    ? t("confirmDeactivateTitle")
                    : confirmAction === "activate"
                      ? t("confirmActivateTitle")
                      : t("confirmRemoveDepartmentTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "delete"
                ? t("confirmDeleteDescription", { name: user.fullName })
                : confirmAction === "reset"
                  ? t("confirmResetDescription", { name: user.fullName })
                  : confirmAction === "deactivate"
                    ? t("confirmDeactivateDescription", { name: user.fullName })
                    : confirmAction === "activate"
                      ? t("confirmActivateDescription", { name: user.fullName })
                      : t("confirmRemoveDepartmentDescription", {
                          name: user.fullName,
                        })}
            </DialogDescription>
          </DialogHeader>
          {actionError ? (
            <Alert variant="destructive">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant={confirmAction === "delete" ? "destructive" : "default"}
              onClick={() => void runConfirmAction()}
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
