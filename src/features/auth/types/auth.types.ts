import type { AppUser } from "@/lib/auth/types";
import type { Role } from "@/lib/permissions";

export type AuthMeResponse = {
  user: AppUser;
  permissions: string[];
};

export type PublicUser = {
  id: string;
  employeeNumber: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  weeklyCapacityHours: number;
  createdAt: string;
  updatedAt: string;
};

export function toPublicUser(user: AppUser): PublicUser {
  return {
    id: user.id,
    employeeNumber: user.employeeNumber,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    weeklyCapacityHours: user.weeklyCapacityHours,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
