"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import type { Announcement } from "@/features/announcements/types/announcement.types";
import type { Role } from "@/lib/permissions";
import { useMarkSeenOnView } from "@/lib/hooks/use-mark-seen-on-view";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  type TablePageSize,
} from "@/lib/table/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { TablePagination } from "@/components/shared/table-pagination";
import { Tabs, TabPanel } from "@/components/shared/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AnnouncementsPageClientProps = {
  viewerRole: Role;
  canManage: boolean;
  managedDepartmentId: string | null;
};

type ListResult = {
  items: Announcement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type DepartmentOption = {
  id: string;
  name: string;
};

async function readApi<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as {
    data?: T;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data as T;
}

function priorityVariant(
  priority: Announcement["priority"],
): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "high") return "destructive";
  if (priority === "medium") return "default";
  return "secondary";
}

export function AnnouncementsPageClient({
  viewerRole,
  canManage,
  managedDepartmentId,
}: AnnouncementsPageClientProps) {
  const t = useTranslations("announcements");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [tab, setTab] = useState("active");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] =
    useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [detail, setDetail] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audienceType, setAudienceType] = useState<"company" | "department">(
    viewerRole === "admin" ? "company" : "department",
  );
  const [departmentId, setDepartmentId] = useState(managedDepartmentId ?? "");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const status = tab as "active" | "expired" | "all";

  const listQuery = useQuery({
    queryKey: ["announcements", "list", page, pageSize, status],
    queryFn: () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        status,
      });
      return fetch(`/api/announcements?${params}`).then((res) =>
        readApi<ListResult>(res),
      );
    },
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments", "options"],
    enabled: canManage,
    queryFn: () =>
      fetch("/api/departments?page=1&pageSize=100").then(async (res) => {
        const data = await readApi<{ items: DepartmentOption[] }>(res);
        return data.items;
      }),
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const resolvedDeptId =
        audienceType === "department"
          ? departmentId || managedDepartmentId || null
          : null;
      return fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          audienceType,
          departmentId: resolvedDeptId,
          priority,
        }),
      }).then((res) => readApi<Announcement>(res));
    },
    onSuccess: async () => {
      setSuccessMessage(t("createSuccess"));
      setActionError(null);
      setDialogOpen(false);
      setTitle("");
      setContent("");
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
      setSuccessMessage(null);
    },
  });

  const expireMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/announcements/${id}`, { method: "DELETE" }).then((res) =>
        readApi<Announcement>(res),
      ),
    onSuccess: async () => {
      setSuccessMessage(t("expireSuccess"));
      setActionError(null);
      setDetail(null);
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
      setSuccessMessage(null);
    },
  });

  const tabItems = useMemo(
    () => [
      { id: "active", label: t("tabActive") },
      { id: "expired", label: t("tabExpired") },
      { id: "all", label: t("tabAll") },
    ],
    [t],
  );

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const unreadIds = items.filter((item) => !item.isRead).map((item) => item.id);
  const detailUnreadIds =
    detail && !detail.isRead ? [detail.id] : ([] as string[]);

  useMarkSeenOnView({
    enabled: listQuery.isSuccess,
    unreadIds,
    endpoint: "/api/announcements/mark-read",
    invalidateQueryKey: ["announcements"],
  });

  useMarkSeenOnView({
    enabled: Boolean(detail && !detail.isRead),
    unreadIds: detailUnreadIds,
    endpoint: "/api/announcements/mark-read",
    invalidateQueryKey: ["announcements"],
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={t("description")}
        actions={
          canManage ? (
            <Button type="button" onClick={() => setDialogOpen(true)}>
              {t("create")}
            </Button>
          ) : null
        }
      />

      {successMessage ? (
        <Alert>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {actionError ? (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs
        items={tabItems}
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          setPage(1);
        }}
      >
        <TabPanel when={tab} active={tab}>
          {listQuery.isLoading ? <LoadingState /> : null}
          {listQuery.isError ? (
            <ErrorState
              title={tCommon("errorTitle")}
              description={
                listQuery.error instanceof Error
                  ? listQuery.error.message
                  : tCommon("unexpectedError")
              }
              onRetry={() => void listQuery.refetch()}
            />
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
            <EmptyState
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          ) : null}

          {!listQuery.isLoading && !listQuery.isError && items.length > 0 ? (
            <>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("colTitle")}</TableHead>
                      <TableHead>{t("colAudience")}</TableHead>
                      <TableHead>{t("colPriority")}</TableHead>
                      <TableHead>{t("colPublish")}</TableHead>
                      <TableHead>{t("colExpires")}</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow
                        key={item.id}
                        className={
                          item.priority === "high" && !item.isRead
                            ? "bg-destructive/5"
                            : !item.isRead
                              ? "bg-primary/5"
                              : undefined
                        }
                      >
                        <TableCell className="font-medium">{item.title}</TableCell>
                        <TableCell>
                          {item.audienceType === "company"
                            ? t("audience_company")
                            : (item.departmentName ?? t("audience_department"))}
                        </TableCell>
                        <TableCell>
                          <Badge variant={priorityVariant(item.priority)}>
                            {t(`priority_${item.priority}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(item.publishAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {item.expiresAt
                            ? formatDateTime(item.expiresAt)
                            : t("noExpiry")}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDetail(item)}
                            >
                              {t("view")}
                            </Button>
                            {canManage && item.isActive ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                disabled={expireMutation.isPending}
                                onClick={() => expireMutation.mutate(item.id)}
                              >
                                {t("expire")}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
        </TabPanel>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">{t("formTitle")}</Label>
              <Input
                id="ann-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-content">{t("formContent")}</Label>
              <textarea
                id="ann-content"
                className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                value={content}
                onChange={(event) => setContent(event.target.value)}
              />
            </div>
            {viewerRole === "admin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ann-audience">{t("formAudience")}</Label>
                <select
                  id="ann-audience"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={audienceType}
                  onChange={(event) =>
                    setAudienceType(
                      event.target.value as "company" | "department",
                    )
                  }
                >
                  <option value="company">{t("audience_company")}</option>
                  <option value="department">{t("audience_department")}</option>
                </select>
              </div>
            ) : null}
            {audienceType === "department" && viewerRole === "admin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ann-dept">{t("formDepartment")}</Label>
                <select
                  id="ann-dept"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  <option value="">{t("selectDepartment")}</option>
                  {(departmentsQuery.data ?? []).map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="ann-priority">{t("formPriority")}</Label>
              <select
                id="ann-priority"
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as "low" | "medium" | "high")
                }
              >
                <option value="low">{t("priority_low")}</option>
                <option value="medium">{t("priority_medium")}</option>
                <option value="high">{t("priority_high")}</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={
                createMutation.isPending ||
                !title.trim() ||
                !content.trim() ||
                (audienceType === "department" &&
                  !(departmentId || managedDepartmentId))
              }
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? t("saving") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{detail?.title ?? t("detailTitle")}</DialogTitle>
          </DialogHeader>
          {detail ? (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-2">
                <Badge variant={priorityVariant(detail.priority)}>
                  {t(`priority_${detail.priority}`)}
                </Badge>
                <Badge variant="outline">
                  {detail.audienceType === "company"
                    ? t("audience_company")
                    : (detail.departmentName ?? t("audience_department"))}
                </Badge>
              </div>
              <p className="whitespace-pre-wrap text-foreground">
                {detail.content}
              </p>
              <p className="text-muted-foreground">
                {formatDateTime(detail.publishAt)}
                {detail.expiresAt
                  ? ` · ${formatDate(detail.expiresAt)}`
                  : ` · ${t("noExpiry")}`}
              </p>
              <div className="flex flex-wrap gap-2">
                {canManage && detail.isActive ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => expireMutation.mutate(detail.id)}
                  >
                    {t("expire")}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
