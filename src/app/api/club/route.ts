import { createClient } from "@/lib/supabase/server";
import { generateInviteCode } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { name, description } = body;

    const { data: club, error } = await supabase
      .from("clubs")
      .insert({
        name,
        description: description || null,
        created_by: user.id,
        invite_code: generateInviteCode(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
      role: "owner",
    });

    return NextResponse.json({ club });
  }

  if (action === "join") {
    const { inviteCode } = body;

    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select()
      .eq("invite_code", inviteCode.toUpperCase().trim())
      .single();

    if (clubError || !club) {
      return NextResponse.json({ error: "Club not found. Check the invite code." }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("club_members")
      .select()
      .eq("club_id", club.id)
      .eq("user_id", user.id)
      .single();

    if (existing) {
      return NextResponse.json({ club });
    }

    await supabase.from("club_members").insert({
      club_id: club.id,
      user_id: user.id,
      role: "member",
    });

    return NextResponse.json({ club });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
