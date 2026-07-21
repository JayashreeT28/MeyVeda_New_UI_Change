/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile based on the HttpOnly JWT.
 */
import { NextRequest } from "next/server";
import { getAuthFromRequest } from "@/backend/middleware/auth.middleware";
import { createClient } from "@/shared/db/supabase.server";
import { successResponse, errorResponse } from "@/lib/utils/response";
import { withErrorHandler } from "@/backend/middleware/error.middleware";

export const GET = withErrorHandler(async (req: NextRequest) => {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return errorResponse("Unauthorized", 401);
  }

  // Fetch latest name/profile info from DB to ensure it's up to date
  const supabase = createClient() as any;

  let realName = auth.name;

  if (auth.role === "practitioner" || auth.role === "doctor") {
    const { data: doc } = await supabase
      .from("practitioners")
      .select("full_name")
      .eq("user_id", auth.id)
      .maybeSingle();
    if (doc?.full_name) {
      realName = doc.full_name;
    }
  } else if (auth.role === "patient") {
    const { data: legacyPat } = await supabase
      .from("patients")
      .select("full_name")
      .eq("user_id", auth.id)
      .maybeSingle();
    if (legacyPat) {
      realName = legacyPat.full_name;
    } else {
      const { data: pat } = await supabase
        .from("patient_profiles")
        .select("full_name")
        .eq("user_id", auth.id)
        .maybeSingle();
      if (pat) realName = pat.full_name;
    }
  }

  return successResponse({
    user: {
      ...auth,
      name: realName !== "Unknown" ? realName : auth.name,
    }
  });
});
