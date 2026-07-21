/**
 * Slots controller — handles slot queries and creation.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/db/supabase.server";
import { errorResponse } from "@/lib/utils/response";

/**
 * GET /api/slots — Get slots for a practitioner.
 */
export async function getSlots(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const practitionerId = searchParams.get("practitioner_id");
  const date = searchParams.get("date");

  if (!practitionerId) {
    return errorResponse("Missing practitioner_id", 400);
  }

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  let query = supabase
    .from("slots")
    .select("*")
    .eq("practitioner_id", practitionerId);

  if (date) {
    query = query.eq("slot_date", date);
  }

  query = query.order("start_time", { ascending: true });

  const { data, error } = await query;

  if (error) {
    return errorResponse(error.message, 500);
  }

  return NextResponse.json({ slots: data });
}

/**
 * POST /api/slots — Insert new slots.
 */
export async function createSlots(req: NextRequest) {
  const body = await req.json();
  const { slots } = body;

  if (!slots || !Array.isArray(slots) || slots.length === 0) {
    return errorResponse("Missing or invalid 'slots' array in request body", 400);
  }

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  const { data, error } = await supabase.from("slots").insert(slots).select();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "Slots inserted successfully", inserted: data });
}
