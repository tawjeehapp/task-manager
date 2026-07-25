/**
 * Idempotent seed for the initial admin account (employee number 0000).
 *
 * Compensating pattern: create Auth user → create profile → delete Auth on profile failure.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

const AUTH_EMAIL_DOMAIN = "task-manager.com";
const EMPLOYEE_NUMBER = "0000";
const EMAIL = `${EMPLOYEE_NUMBER}@${AUTH_EMAIL_DOMAIN}`;
const TEMPORARY_PASSWORD = EMPLOYEE_NUMBER;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: existingProfile } = await admin
    .from("users")
    .select("id, auth_user_id")
    .eq("employee_number", EMPLOYEE_NUMBER)
    .maybeSingle();

  if (existingProfile) {
    console.log("Admin profile already exists:", existingProfile.id);
    return;
  }

  const { data: listed } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  let authUserId = listed?.users.find((u) => u.email === EMAIL)?.id;

  if (!authUserId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: EMAIL,
        password: TEMPORARY_PASSWORD,
        email_confirm: true,
        user_metadata: {
          employee_number: EMPLOYEE_NUMBER,
          full_name: "مسؤول النظام",
        },
      });

    if (createError || !created.user) {
      throw createError ?? new Error("Failed to create auth user");
    }

    authUserId = created.user.id;
    console.log("Created auth user:", authUserId);
  } else {
    console.log("Auth user already exists:", authUserId);
  }

  const { data: profile, error: profileError } = await admin
    .from("users")
    .insert({
      auth_user_id: authUserId,
      employee_number: EMPLOYEE_NUMBER,
      full_name: "مسؤول النظام",
      email: EMAIL,
      phone: null,
      role: "admin",
      is_active: true,
      must_change_password: true,
    })
    .select("id")
    .single();

  if (profileError || !profile) {
    // Compensate only if we just created a dangling auth user without profile.
    // If auth user pre-existed from a partial run, still try to clean up only when
    // there is no other profile linked — safest: delete auth user we know has no profile.
    await admin.auth.admin.deleteUser(authUserId);
    throw profileError ?? new Error("Failed to create admin profile");
  }

  console.log("Seeded admin user profile:", profile.id);
  console.log("Employee number:", EMPLOYEE_NUMBER);
  console.log("Temporary password:", TEMPORARY_PASSWORD);
  console.log("must_change_password: true");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
