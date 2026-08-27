import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Service-role client. Never import this module from client components.
// `.schema("public")` works around a type-inference issue in the current
// supabase-js/postgrest-js versions where passing a client options object
// otherwise causes `.from()` results to type as `never`.
export function createServiceRoleSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  ).schema("public");
}
