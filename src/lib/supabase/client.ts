import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

// Kept in sync via onAuthStateChange so it's readable synchronously (no
// awaiting a promise) from a pagehide handler, where the page may already be
// gone by the time an async call would resolve.
let latestAccessToken: string | null = null;

/** Singleton browser Supabase client (anon/publishable key, RLS-enforced). */
export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    client.auth.onAuthStateChange((_event, session) => {
      latestAccessToken = session?.access_token ?? null;
    });
  }
  return client;
}

/** The current session's access token, if any — see latestAccessToken above. */
export function getLatestAccessToken() {
  return latestAccessToken;
}
