"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";

import {
  createUserSchema,
  type CreateUserInput,
} from "@/features/users/schemas/user.schema";
import type { PublicUser } from "@/features/auth/types/auth.types";
import type { UsersListResult } from "@/features/users/types/user.types";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

async function fetchUsers(search: string): Promise<UsersListResult> {
  const params = new URLSearchParams();
  if (search) {
    params.set("search", search);
  }
  const response = await fetch(`/api/users?${params.toString()}`);
  const payload = (await response.json()) as {
    data?: UsersListResult;
    error?: { message: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Failed to load users");
  }
  return payload.data!;
}

export function EmployeesPageClient() {
  const t = useTranslations("employees");
  const tRoles = useTranslations("roles");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "delete" | "reset" | "deactivate" | "activate";
    user: PublicUser;
  } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users", search],
    queryFn: () => fetchUsers(search),
  });

  const createForm = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      employeeNumber: "",
      fullName: "",
      phone: "",
      role: "employee",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserInput) => {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("createFailed"));
      }
    },
    onSuccess: async () => {
      setCreateOpen(false);
      createForm.reset();
      setSuccessMessage(t("createSuccess"));
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const patchMutation = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, unknown>;
    }) => {
      const response = await fetch(`/api/users/${id}`, {
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
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}`, { method: "DELETE" });
      const payload = (await response.json()) as {
        error?: { message: string };
      };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? t("deleteFailed"));
      }
    },
    onSuccess: async () => {
      setConfirmAction(null);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/users/${id}/reset-password`, {
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
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  async function runConfirmAction() {
    if (!confirmAction) {
      return;
    }
    setActionError(null);
    setSuccessMessage(null);
    const actionUser = confirmAction.user;
    const actionType = confirmAction.type;
    try {
      if (actionType === "delete") {
        await deleteMutation.mutateAsync(actionUser.id);
        setSuccessMessage(
          t("deleteSuccess", { name: actionUser.fullName }),
        );
      } else if (actionType === "reset") {
        await resetMutation.mutateAsync(actionUser.id);
        setSuccessMessage(
          t("resetSuccess", {
            name: actionUser.fullName,
            employeeNumber: actionUser.employeeNumber,
          }),
        );
      } else if (actionType === "deactivate") {
        await patchMutation.mutateAsync({
          id: actionUser.id,
          body: { isActive: false },
        });
        setSuccessMessage(
          t("deactivateSuccess", { name: actionUser.fullName }),
        );
      } else {
        await patchMutation.mutateAsync({
          id: actionUser.id,
          body: { isActive: true },
        });
        setSuccessMessage(
          t("activateSuccess", { name: actionUser.fullName }),
        );
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : tCommon("unexpectedError"),
      );
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
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
                <DialogDescription>{t("createDescription")}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4"
                onSubmit={createForm.handleSubmit(async (values) => {
                  try {
                    setSuccessMessage(null);
                    await createMutation.mutateAsync(values);
                  } catch (error) {
                    createForm.setError("root", {
                      message:
                        error instanceof Error
                          ? error.message
                          : t("createFailed"),
                    });
                  }
                })}
              >
                <div className="space-y-2">
                  <Label htmlFor="employeeNumber">{t("employeeNumber")}</Label>
                  <Input
                    id="employeeNumber"
                    maxLength={4}
                    inputMode="numeric"
                    {...createForm.register("employeeNumber")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t("fullName")}</Label>
                  <Input id="fullName" {...createForm.register("fullName")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("phone")}</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="09xxxxxxxx"
                    aria-invalid={Boolean(createForm.formState.errors.phone)}
                    {...createForm.register("phone")}
                  />
                  {createForm.formState.errors.phone ? (
                    <p className="text-sm text-destructive">
                      {createForm.formState.errors.phone.message}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("phoneHint")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">{t("role")}</Label>
                  <select
                    id="role"
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    {...createForm.register("role")}
                  >
                    <option value="employee">{tRoles("employee")}</option>
                    <option value="department_manager">
                      {tRoles("department_manager")}
                    </option>
                    <option value="admin">{tRoles("admin")}</option>
                  </select>
                </div>
                {createForm.formState.errors.root ? (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {createForm.formState.errors.root.message}
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
        }
      />

      {successMessage ? (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
      </div>

      {usersQuery.isLoading ? <LoadingState /> : null}
      {usersQuery.isError ? (
        <ErrorState
          title={tCommon("errorTitle")}
          description={
            usersQuery.error instanceof Error
              ? usersQuery.error.message
              : undefined
          }
          onRetry={() => usersQuery.refetch()}
        />
      ) : null}

      {usersQuery.data && usersQuery.data.items.length === 0 ? (
        <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
      ) : null}

      {usersQuery.data && usersQuery.data.items.length > 0 ? (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employeeNumber")}</TableHead>
                <TableHead>{t("fullName")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-start">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersQuery.data.items.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.employeeNumber}
                  </TableCell>
                  <TableCell>{user.fullName}</TableCell>
                  <TableCell>{tRoles(user.role)}</TableCell>
                  <TableCell>{user.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "secondary"}>
                      {user.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setConfirmAction({
                            type: user.isActive ? "deactivate" : "activate",
                            user,
                          })
                        }
                      >
                        {user.isActive ? t("deactivate") : t("activate")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setConfirmAction({ type: "reset", user })
                        }
                      >
                        {t("resetPassword")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          setConfirmAction({ type: "delete", user })
                        }
                      >
                        {t("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

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
              {confirmAction?.type === "delete"
                ? t("confirmDeleteTitle")
                : confirmAction?.type === "reset"
                  ? t("confirmResetTitle")
                  : confirmAction?.type === "deactivate"
                    ? t("confirmDeactivateTitle")
                    : t("confirmActivateTitle")}
            </DialogTitle>
            <DialogDescription>
              {confirmAction?.type === "delete"
                ? t("confirmDeleteDescription", {
                    name: confirmAction.user.fullName,
                  })
                : confirmAction?.type === "reset"
                  ? t("confirmResetDescription", {
                      name: confirmAction?.user.fullName ?? "",
                    })
                  : confirmAction?.type === "deactivate"
                    ? t("confirmDeactivateDescription", {
                        name: confirmAction?.user.fullName ?? "",
                      })
                    : t("confirmActivateDescription", {
                        name: confirmAction?.user.fullName ?? "",
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
              variant={
                confirmAction?.type === "delete" ? "destructive" : "default"
              }
              onClick={() => void runConfirmAction()}
              disabled={
                deleteMutation.isPending ||
                resetMutation.isPending ||
                patchMutation.isPending
              }
            >
              {tCommon("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
