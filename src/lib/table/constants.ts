/** Shared data-table conventions for list pages. */
export const TABLE_PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export type TablePageSize = (typeof TABLE_PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_TABLE_PAGE_SIZE: TablePageSize = 25;

/** Seed / system admin employee number — hidden from directory lists. */
export const SYSTEM_ADMIN_EMPLOYEE_NUMBER = "0000";

export type SortDirection = "asc" | "desc";
