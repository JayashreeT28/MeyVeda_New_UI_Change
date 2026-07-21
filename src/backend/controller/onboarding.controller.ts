/**
 * Onboarding controller — handles patient onboarding.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/shared/db/supabase.server";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { cookies } from "next/headers";
import { successResponse, errorResponse } from "@/lib/utils/response";
import { getAuthFromRequest } from "@/backend/middleware/auth.middleware";
import { requireAuth } from "@/shared/auth/require-auth";
import { AppError } from "@/shared/api/api-error";
import { OnboardingService } from "../service/onboarding.service";

/**
 * POST /api/onboarding/patient
 * Creates or updates user and patient profile via SECURITY DEFINER RPCs.
 */
export async function createPatient(req: NextRequest) {
  const body = await req.json();
  const {
    email,
    fullName,
    dateOfBirth,
    gender,
    phone,
    address,
    abhaNumber,
    emergencyContactName,
    emergencyContactPhone,
    allergies,
    chronicConditions,
    currentMedications,
  } = body;

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  // 1. Resolve or create the users row
  const { data: userIdData, error: userErr } = await supabase
    .rpc("upsert_user_by_email", {
      p_email: email,
      p_role: "patient",
    });

  if (userErr) {
    console.error("[API] upsert_user_by_email error:", userErr);
    return errorResponse(userErr.message, 500);
  }

  const userId = userIdData as string;
  if (!userId) {
    return errorResponse("Failed to resolve user ID", 500);
  }

  // 2. Upsert patient profile via SECURITY DEFINER RPC
  const { error: profileErr } = await supabase.rpc(
    "upsert_patient_profile",
    {
      p_user_id: userId,
      p_full_name: fullName,
      p_date_of_birth: dateOfBirth,
      p_gender: gender,
      p_phone: phone ?? "",
      p_email: email,
      p_address: address ?? null,
      p_abha_number: abhaNumber ?? null,
      p_emergency_contact_name: emergencyContactName ?? null,
      p_emergency_contact_phone: emergencyContactPhone ?? null,
      p_allergies: allergies ?? [],
      p_chronic_conditions: chronicConditions ?? [],
      p_current_medications: currentMedications ?? [],
    }
  );

  if (profileErr) {
    console.error("[API] upsert_patient_profile error:", profileErr);
    return errorResponse(profileErr.message, 500);
  }

  // Issue Auth Cookies for the new patient
  const tokenPayload = {
    id: userId,
    email: email,
    phone: phone || "",
    role: "patient" as const,
    name: fullName,
  };
  
  const accessToken = await signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  const cookieStore = await cookies();
  const isDev = process.env.NODE_ENV !== "production";
  cookieStore.set("access_token", accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: isDev ? 7 * 24 * 60 * 60 : 15 * 60,
  });
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60,
  });

  return successResponse({ userId });
}

/**
 * POST /api/auth/onboard-doctor
 */
export async function onboardDoctor(req: NextRequest) {
  const body = await req.json();
  const { email, phone, fullName, ...rest } = body;

  if (!email || !fullName) {
    return errorResponse("Email and full name are required", 400);
  }

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  // 1. Resolve or create the users row
  const { data: userIdData, error: userErr } = await supabase
    .rpc("upsert_user_by_email", {
      p_email: email,
      p_role: "practitioner",
    });

  if (userErr) {
    console.error("[API] upsert_user_by_email error:", userErr);
    return errorResponse(userErr.message, 500);
  }

  const userId = userIdData as string;
  if (!userId) {
    return errorResponse("Failed to resolve user ID", 500);
  }

  // Update phone if provided
  if (phone) {
    await supabase.from("users").update({ mobile: phone }).eq("id", userId);
  }

  try {
    // 2. Save doctor profile and verification request
    await OnboardingService.saveDoctorProfile({ ...rest, fullName, userId });
    
    // 3. Issue Auth Cookies
    const tokenPayload = {
      id: userId,
      email: email,
      phone: phone || "",
      role: "practitioner" as const,
      name: fullName,
    };
    
    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);
    
    const cookieStore = await cookies();
    const isDev = process.env.NODE_ENV !== "production";
    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: isDev ? 7 * 24 * 60 * 60 : 15 * 60,
    });
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    
    return successResponse({ success: true, userId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save doctor profile";
    return errorResponse(message, 500);
  }
}

/**
 * POST /api/auth/onboard-patient
 */
export async function onboardPatient(req: NextRequest) {
  const body = await req.json();
  const { email, fullName, dateOfBirth, gender, phone, address, abhaNumber,
    emergencyContactName, emergencyContactPhone, allergies, chronicConditions, currentMedications } = body;

  if (!email || !fullName) {
    return errorResponse("Email and full name are required", 400);
  }

  const supabase: any = createClient();

  // 1. Upsert the users row
  const { data: userIdData, error: userErr } = await supabase.rpc("upsert_user_by_email", {
    p_email: email,
    p_role: "patient",
  });

  if (userErr) {
    console.error("[onboardPatient] upsert_user_by_email error:", userErr);
    return errorResponse(userErr.message, 500);
  }

  const userId = userIdData as string;
  if (!userId) return errorResponse("Failed to resolve user ID", 500);

  // 2. Upsert patient profile
  const { error: profileErr } = await supabase.rpc("upsert_patient_profile", {
    p_user_id: userId,
    p_full_name: fullName,
    p_date_of_birth: dateOfBirth ?? null,
    p_gender: gender ?? null,
    p_phone: phone ?? "",
    p_email: email,
    p_address: address ?? null,
    p_abha_number: abhaNumber ?? null,
    p_emergency_contact_name: emergencyContactName ?? null,
    p_emergency_contact_phone: emergencyContactPhone ?? null,
    p_allergies: allergies ?? [],
    p_chronic_conditions: chronicConditions ?? [],
    p_current_medications: currentMedications ?? [],
  });

  if (profileErr) {
    console.error("[onboardPatient] upsert_patient_profile error:", profileErr);
    return errorResponse(profileErr.message, 500);
  }

  // 3. Issue auth cookies so the user is immediately logged in
  try {
    const { signAccessToken, signRefreshToken } = await import("@/lib/jwt");
    const { cookies } = await import("next/headers");

    const tokenPayload = { id: userId, email, phone: phone ?? "", role: "patient", name: fullName };
    const accessToken = await signAccessToken(tokenPayload);
    const refreshToken = await signRefreshToken(tokenPayload);

    const cookieStore = await cookies();
    const isDev = process.env.NODE_ENV !== "production";
    cookieStore.set("access_token", accessToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: isDev ? 7 * 24 * 60 * 60 : 15 * 60,
    });
    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 7 * 24 * 60 * 60,
    });
  } catch (tokenErr) {
    console.error("[onboardPatient] token signing error:", tokenErr);
    // Non-fatal — user can still log in manually
  }

  return successResponse({ success: true, userId });
}

/**
 * GET /api/admin/doctor-verifications
 */
export async function getVerificationQueue(req: NextRequest) {
  try {
    const authUser = await requireAuth(req);
    const data = await OnboardingService.getVerificationQueue(authUser);
    return successResponse(data);
  } catch (error: unknown) {
    const statusCode = error instanceof AppError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Failed to fetch verification queue";
    return errorResponse(message, statusCode);
  }
}

/**
 * POST /api/admin/doctor-verifications/[id]
 */
export async function verifyDoctorController(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await requireAuth(req);
    const { id } = await context.params;
    const body = await req.json();
    await OnboardingService.verifyDoctor(authUser, id, body.doctorId, body.status, body.reason);
    return successResponse({ success: true });
  } catch (error: unknown) {
    const statusCode = error instanceof AppError ? error.statusCode : 400;
    const message = error instanceof Error ? error.message : "Failed to update verification";
    return errorResponse(message, statusCode);
  }
}

/**
 * GET /api/auth/onboard-doctor
 */
export async function getMyDoctorProfile(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return errorResponse("Unauthorized", 401);
  }
  const data = await OnboardingService.getDoctorProfile(auth.id);
  return successResponse(data);
}

/**
 * GET /api/auth/onboard-patient
 */
export async function getMyPatientProfile(req: NextRequest) {
  const auth = await getAuthFromRequest(req);
  if (!auth) {
    return errorResponse("Unauthorized", 401);
  }
  const data = await OnboardingService.getPatientProfile(auth.id);
  return successResponse(data);
}
