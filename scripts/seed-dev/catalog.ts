/**
 * Fixed IDs and fixtures for the development seed.
 * All UUIDs are stable so upsert / --reset only touch seed-owned rows.
 */

export const AUTH_EMAIL_DOMAIN = "task-manager.com";
export const ATTENDANCE_TIMEZONE = "Asia/Riyadh";

/** Seed employee numbers (admin 0000 is ensured, not reset-deleted). */
export const SEED_EMPLOYEE_NUMBERS = [
  "0000",
  "1001",
  "1002",
  "1003",
  "1004",
  "1005",
  "1006",
  "1007",
  "1008",
] as const;

export type SeedUserDef = {
  employeeNumber: string;
  fullName: string;
  role: "admin" | "department_manager" | "employee";
  phone: string | null;
};

export const SEED_USERS: SeedUserDef[] = [
  {
    employeeNumber: "0000",
    fullName: "مسؤول النظام",
    role: "admin",
    phone: null,
  },
  {
    employeeNumber: "1001",
    fullName: "أحمد التقني",
    role: "department_manager",
    phone: "0500001001",
  },
  {
    employeeNumber: "1002",
    fullName: "فاطمة المخططة",
    role: "department_manager",
    phone: "0500001002",
  },
  {
    employeeNumber: "1003",
    fullName: "سارة المطورة",
    role: "employee",
    phone: "0500001003",
  },
  {
    employeeNumber: "1004",
    fullName: "خالد الدعم",
    role: "employee",
    phone: "0500001004",
  },
  {
    employeeNumber: "1005",
    fullName: "نور المهندسة",
    role: "employee",
    phone: "0500001005",
  },
  {
    employeeNumber: "1006",
    fullName: "يوسف المصمم",
    role: "employee",
    phone: "0500001006",
  },
  {
    employeeNumber: "1007",
    fullName: "ليلى الكاتبة",
    role: "employee",
    phone: "0500001007",
  },
  {
    employeeNumber: "1008",
    fullName: "عمر المراجع",
    role: "employee",
    phone: "0500001008",
  },
];

export const IDS = {
  deptIt: "a1000001-0000-4000-8000-000000000001",
  deptCurriculum: "a1000001-0000-4000-8000-000000000002",

  memIt1001: "a1000002-0000-4000-8000-000000000001",
  memIt1003: "a1000002-0000-4000-8000-000000000003",
  memIt1004: "a1000002-0000-4000-8000-000000000004",
  memIt1005: "a1000002-0000-4000-8000-000000000005",
  memCur1002: "a1000002-0000-4000-8000-000000000012",
  memCur1006: "a1000002-0000-4000-8000-000000000016",
  memCur1007: "a1000002-0000-4000-8000-000000000017",
  memCur1008: "a1000002-0000-4000-8000-000000000018",

  projectPlatform: "a1000003-0000-4000-8000-000000000001",
  projectInfra: "a1000003-0000-4000-8000-000000000002",
  projectCurriculum: "a1000003-0000-4000-8000-000000000003",

  pmPlatform1001: "a1000004-0000-4000-8000-000000000001",
  pmPlatform1003: "a1000004-0000-4000-8000-000000000003",
  pmPlatform1004: "a1000004-0000-4000-8000-000000000004",
  pmPlatform1005: "a1000004-0000-4000-8000-000000000005",
  pmInfra1001: "a1000004-0000-4000-8000-000000000011",
  pmInfra1004: "a1000004-0000-4000-8000-000000000014",
  pmCur1002: "a1000004-0000-4000-8000-000000000021",
  pmCur1006: "a1000004-0000-4000-8000-000000000026",
  pmCur1007: "a1000004-0000-4000-8000-000000000027",
  pmCur1008: "a1000004-0000-4000-8000-000000000028",

  taskAttendanceUi: "a1000005-0000-4000-8000-000000000001",
  taskDesignScreen: "a1000005-0000-4000-8000-000000000002",
  taskWireApi: "a1000005-0000-4000-8000-000000000003",
  taskReviewPerms: "a1000005-0000-4000-8000-000000000004",
  taskDocsDeploy: "a1000005-0000-4000-8000-000000000005",
  taskPerf: "a1000005-0000-4000-8000-000000000006",
  taskUnassigned: "a1000005-0000-4000-8000-000000000007",

  taskGatherReqs: "a1000005-0000-4000-8000-000000000011",
  taskDraft: "a1000005-0000-4000-8000-000000000012",
  taskLangReview: "a1000005-0000-4000-8000-000000000013",

  depWireOnDesign: "a1000006-0000-4000-8000-000000000001",
  depReviewOnAttendanceUi: "a1000006-0000-4000-8000-000000000002",
  depDocsOnReview: "a1000006-0000-4000-8000-000000000003",
  depDraftOnGather: "a1000006-0000-4000-8000-000000000004",

  attSaraOpen: "a1000007-0000-4000-8000-000000000001",
  attKhalidAwaiting: "a1000007-0000-4000-8000-000000000002",
  attNoorApproved: "a1000007-0000-4000-8000-000000000003",
  attYousefRejected: "a1000007-0000-4000-8000-000000000004",
  attLaylaResubmitted: "a1000007-0000-4000-8000-000000000005",
  attAhmedApproved: "a1000007-0000-4000-8000-000000000006",
  attOmarApprovedOld: "a1000007-0000-4000-8000-000000000007",

  wlSaraParent1: "a1000008-0000-4000-8000-000000000001",
  wlSaraSubtask1: "a1000008-0000-4000-8000-000000000002",
  wlSaraParent2: "a1000008-0000-4000-8000-000000000003",
  wlKhalid1: "a1000008-0000-4000-8000-000000000004",
  wlYousef1: "a1000008-0000-4000-8000-000000000005",
  wlLayla1: "a1000008-0000-4000-8000-000000000006",
} as const;

/** All seed-owned row IDs deleted on --reset (never includes users / auth). */
export const RESET_ID_SETS = {
  work_logs: [
    IDS.wlSaraParent1,
    IDS.wlSaraSubtask1,
    IDS.wlSaraParent2,
    IDS.wlKhalid1,
    IDS.wlYousef1,
    IDS.wlLayla1,
  ],
  task_dependencies: [
    IDS.depWireOnDesign,
    IDS.depReviewOnAttendanceUi,
    IDS.depDocsOnReview,
    IDS.depDraftOnGather,
  ],
  tasks: [
    IDS.taskDesignScreen,
    IDS.taskWireApi,
    IDS.taskAttendanceUi,
    IDS.taskReviewPerms,
    IDS.taskDocsDeploy,
    IDS.taskPerf,
    IDS.taskUnassigned,
    IDS.taskGatherReqs,
    IDS.taskDraft,
    IDS.taskLangReview,
  ],
  project_members: [
    IDS.pmPlatform1001,
    IDS.pmPlatform1003,
    IDS.pmPlatform1004,
    IDS.pmPlatform1005,
    IDS.pmInfra1001,
    IDS.pmInfra1004,
    IDS.pmCur1002,
    IDS.pmCur1006,
    IDS.pmCur1007,
    IDS.pmCur1008,
  ],
  projects: [IDS.projectPlatform, IDS.projectInfra, IDS.projectCurriculum],
  attendance_records: [
    IDS.attSaraOpen,
    IDS.attKhalidAwaiting,
    IDS.attNoorApproved,
    IDS.attYousefRejected,
    IDS.attLaylaResubmitted,
    IDS.attAhmedApproved,
    IDS.attOmarApprovedOld,
  ],
  department_memberships: [
    IDS.memIt1001,
    IDS.memIt1003,
    IDS.memIt1004,
    IDS.memIt1005,
    IDS.memCur1002,
    IDS.memCur1006,
    IDS.memCur1007,
    IDS.memCur1008,
  ],
  departments: [IDS.deptIt, IDS.deptCurriculum],
} as const;
