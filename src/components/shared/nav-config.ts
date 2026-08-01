import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  Building2,
  CheckSquare,
  ClipboardList,
  Clock3,
  FolderKanban,
  Home,
  LayoutDashboard,
  Megaphone,
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
  /** When set, item is shown only for these roles. */
  showForRoles?: Role[];
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
  if (item.showForRoles && item.showForRoles.length > 0) {
    if (!role || !item.showForRoles.includes(role)) {
      return false;
    }
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
        key: "departmentDashboard",
        href: "/",
        icon: BarChart3,
        enabled: true,
        showForRoles: ["department_manager"],
      },
      {
        key: "myDashboard",
        href: "/me",
        icon: Home,
        enabled: true,
        showForRoles: ["department_manager"],
      },
      {
        key: "dashboard",
        href: "/",
        icon: LayoutDashboard,
        enabled: true,
        hideForRoles: ["department_manager"],
      },
      {
        key: "tasks",
        href: "/tasks",
        icon: ClipboardList,
        enabled: true,
        permission: "project.view",
      },
      {
        key: "projects",
        href: "/projects",
        icon: FolderKanban,
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
    ],
  },
  {
    key: "organization",
    items: [
      {
        key: "teamTasks",
        href: "/tasks/team",
        icon: ClipboardList,
        enabled: true,
        permission: "project.view",
        showForRoles: ["department_manager"],
      },
      {
        key: "attendanceLeave",
        href: "/attendance",
        icon: Clock3,
        enabled: true,
        anyOfPermissions: ["attendance.view", "leave.view"],
      },
      {
        key: "departments",
        href: "/departments",
        icon: Building2,
        enabled: true,
        permission: "department.view",
        hideForRoles: ["employee"],
      },
      {
        key: "employees",
        href: "/employees",
        icon: Users,
        enabled: true,
        anyOfPermissions: ["user.manage", "user.reset_password"],
      },
      {
        key: "requests",
        href: "/approvals",
        icon: CheckSquare,
        enabled: true,
        anyOfPermissions: [
          "leave.approve",
          "employee_request.approve",
          "attendance.approve",
          "project_request.approve",
        ],
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
    ],
  },
];

/** Mobile bottom nav: Dashboard, Tasks, Notifications. */
export const mobileNavItems: NavItem[] = [
  {
    key: "dashboard",
    href: "/",
    icon: LayoutDashboard,
    enabled: true,
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
