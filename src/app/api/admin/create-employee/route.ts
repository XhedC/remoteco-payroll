import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Role, EmployeeStatus } from "@/lib/types";

interface CreateEmployeeBody {
  name: string;
  email: string;
  role: Role;
  department: string;
  title: string;
  status: EmployeeStatus;
  hourlyRate: number;
  password: string;
}

/**
 * Admin-only employee provisioning. The client SDK can never create another
 * user's login (that requires the service-role key, which must stay server
 * side), so this route does it on the Admin's behalf after re-checking their
 * role from the database — never trusting a client-supplied role claim.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const accessToken = authHeader?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: callerEmployee, error: callerError } = await admin
    .from("employees")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (callerError || callerEmployee?.role !== "Admin") {
    return NextResponse.json({ error: "Only an Admin can create accounts." }, { status: 403 });
  }

  const body = (await request.json()) as CreateEmployeeBody;
  const email = body.email.trim().toLowerCase();

  if (!body.name?.trim() || !email || !body.department?.trim() || !body.title?.trim()) {
    return NextResponse.json({ error: "Please fill in all required fields." }, { status: 400 });
  }
  if (!body.password || body.password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const { data: existing } = await admin
    .from("employees")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: body.password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return NextResponse.json(
      { error: createError?.message ?? "Unable to create this account." },
      { status: 400 },
    );
  }

  const { data: employee, error: insertError } = await admin
    .from("employees")
    .insert({
      id: created.user.id,
      name: body.name.trim(),
      email,
      role: body.role,
      department: body.department.trim(),
      title: body.title.trim(),
      status: body.status,
      hourly_rate: body.hourlyRate,
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError || !employee) {
    // Roll back the orphaned auth user if the employee row failed to insert.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: insertError?.message ?? "Unable to create this account." },
      { status: 400 },
    );
  }

  return NextResponse.json({ employee });
}
