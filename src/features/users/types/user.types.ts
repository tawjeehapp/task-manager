import type { PublicUser } from "@/features/auth/types/auth.types";

export type UsersListResult = {
  items: PublicUser[];
  total: number;
  page: number;
  pageSize: number;
};
