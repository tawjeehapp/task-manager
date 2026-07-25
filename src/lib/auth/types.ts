import type { Role } from "@/lib/permissions";

export type AppUser = {
  id: string;
  authUserId: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  accessToken: string;
  user: AppUser;
};

/** @deprecated Prefer AppUser — kept for gradual migration of stubs */
export type AuthUser = AppUser;

export type UserRow = {
  id: string;
  auth_user_id: string;
  employee_number: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
};

export function mapUserRow(row: UserRow): AppUser {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    employeeNumber: row.employee_number,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    role: row.role,
    isActive: row.is_active,
    mustChangePassword: row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
