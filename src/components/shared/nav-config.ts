import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";

import type { Role } from "@/lib/permissions";

export type NavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
  /** When set, item is shown only if the user has this permission code. */
  permission?: string;
  /** When set, item is shown if the user has any of these permission codes. */
  anyOfPermissions?: string[];
  /** When set, item is hidden from these roles (e.g. employees). */
  hideForRoles?: Role[];
};

export type NavSection = {
  key: string;
  items: NavItem[];
};

export function navItemIsVisible(
  item: NavItem,
  permissions: readonly string[],
  role?: Role | null,
): boolean {
  if (role && item.hideForRoles?.includes(role)) {
    return false;
  }
  if (!item.enabled) {
    return true;
  }
  if (item.anyOfPermissions && item.anyOfPermissions.length > 0) {
    return item.anyOfPermissions.some((code) => permissions.includes(code));
  }
  if (item.permission) {
    return permissions.includes(item.permission);
  }
  return true;
}

export const navSections: NavSection[] = [
  {
    key: "main",
    items: [
      {
        key: "dashboard",
        href: "/",
        icon: LayoutDashboard,
        enabled: true,
      },
      {
        key: "projects",
        href: "/projects",
        icon: FolderKanban,
        enabled: true,
        permission: "project.view",
      },
      {
        key: "tasks",
        href: "/tasks",
        icon: ClipboardList,
        enabled: true,
        permission: "project.view",
      },
    ],
  },
  {
    key: "organization",
    items: [
      {
        key: "departments",
        href: "/departments",
        icon: Building2,
        enabled: true,
        permission: "department.view",
      },
      {
        key: "employees",
        href: "/employees",
        icon: Users,
        enabled: true,
        anyOfPermissions: ["user.manage", "user.reset_password"],
      },
    ],
  },
  {
    key: "operations",
    items: [
      {
        key: "attendance",
        href: "/attendance",
        icon: CalendarCheck,
        enabled: true,
        permission: "attendance.view",
      },
      {
        key: "leave",
        href: "/leave",
        icon: CalendarDays,
        enabled: true,
        permission: "leave.view",
      },
      {
        key: "approvals",
        href: "/approvals",
        icon: CheckSquare,
        enabled: true,
        anyOfPermissions: ["leave.approve", "employee_request.approve"],
      },
    ],
  },
  {
    key: "communication",
    items: [
      {
        key: "announcements",
        href: "/announcements",
        icon: Megaphone,
        enabled: true,
        permission: "announcement.view",
      },
      {
        key: "notifications",
        href: "/notifications",
        icon: Bell,
        enabled: true,
        permission: "notification.view",
      },
    ],
  },
  {
    key: "analytics",
    items: [
      {
        key: "reports",
        href: "#",
        icon: FileText,
        enabled: false,
        hideForRoles: ["employee"],
      },
    ],
  },
  {
    key: "administration",
    items: [
      {
        key: "settings",
        href: "#",
        icon: Settings,
        enabled: false,
        hideForRoles: ["employee"],
      },
    ],
  },
];

export const mobileNavItems: NavItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    key: "projects",
    href: "/projects",
    icon: FolderKanban,
    enabled: true,
    permission: "project.view",
  },
  {
    key: "tasks",
    href: "/tasks",
    icon: ClipboardList,
    enabled: true,
    permission: "project.view",
  },
  {
    key: "notifications",
    href: "/notifications",
    icon: Bell,
    enabled: true,
    permission: "notification.view",
  },
];
