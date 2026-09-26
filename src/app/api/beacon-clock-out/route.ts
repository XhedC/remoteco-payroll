import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Best-effort auto clock-out/logout when the app is closed (tab/browser
 * close, or navigating away) rather than an explicit "Log out" click.
 * Called via navigator.sendBeacon from a pagehide listener, which only
 * supports a plain POST body — no Authorization header — so the access
 * token travels in the body instead and is verified here before acting.
 *
 * This is inherently best-effort: browsers don't guarantee any handler
 * runs on a hard crash or force-quit, and the same pagehide event also
 * fires on an ordinary page refresh, which this can't distinguish from an
 * actual close.
 */
export async function POST(request: Request) {
  const admin = getSupabaseAdminClient();

  let accessToken: string | undefined;
  try {
    const body = await request.json();
    accessToken = body?.accessToken;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!accessToken) {
    return NextResponse.json({ error: "Missing access token." }, { status: 401 });
  }

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const employeeId = userData.user.id;

  const { data: active } = await admin
    .from("time_entries")
    .select("id, note")
    .eq("employee_id", employeeId)
    .is("clock_out", null)
    .maybeSingle();

  if (active) {
    await admin
      .from("time_entries")
      .update({ clock_out: new Date().toISOString() })
      .eq("id", active.id);

    await admin.from("screen_logs").insert({
      employee_id: employeeId,
      action: "Clock Out",
      detail: "Clocked out automatically (app closed)",
      device: request.headers.get("user-agent") ?? "Web",
    });
  }

  await admin.from("screen_logs").insert({
    employee_id: employeeId,
    action: "Logout",
    detail: "Signed out automatically (app closed)",
    device: request.headers.get("user-agent") ?? "Web",
  });

  return NextResponse.json({ success: true });
}
