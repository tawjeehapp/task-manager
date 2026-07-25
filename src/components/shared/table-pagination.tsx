"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSize,
} from "@/lib/table/constants";

type TablePaginationProps = {
  page: number;
  pageSize: TablePageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: TablePageSize) => void;
};

export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: TablePaginationProps) {
  const t = useTranslations("table");
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        {t("showing", { from, to, total })}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("pageSize")}</span>
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm text-foreground"
            value={pageSize}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value) as TablePageSize);
            }}
          >
            {TABLE_PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t("previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("pageOf", { page, totalPages })}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_TABLE_PAGE_SIZE };
