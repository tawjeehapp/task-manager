import { createBrowserClient } from "@supabase/ssr";

import { requireSupabasePublicConfig } from "@/config/env";

export function createClient() {
  const { url, anonKey } = requireSupabasePublicConfig();

  return createBrowserClient(url, anonKey);
}
