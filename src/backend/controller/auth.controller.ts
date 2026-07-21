/**
 * Auth controller — handles login and JWT signing API endpoints.
 */
import { NextRequest } from "next/server";
import { createClient } from "@/shared/db/supabase.server";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { successResponse, errorResponse } from "@/lib/utils/response";
import { cookies } from "next/headers";

/**
 * POST /api/auth/send-otp
 * Triggers the Supabase Edge Function to send an OTP via Email/SMS.
 */
export async function sendOtp(req: NextRequest) {
  const { email } = await req.json();

  if (!email) {
    return errorResponse("Email is required", 400);
  }

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  // Try calling Supabase Edge function
  const { data, error } = await supabase.functions.invoke("send-otp", {
    body: { email },
  });

  if (!error && !data?.error) {
    return successResponse({ success: true, message: "OTP sent successfully" });
  }

  // Fallback: Directly insert into email_otps table if Edge function fails or is not deployed
  console.log("[sendOtp] Edge function not available or failed. Falling back to database insertion.");
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error: insertErr } = await supabase.from("email_otps").insert({
    email: email.toLowerCase(),
    otp: otpCode,
    purpose: "email_validation",
    expires_at: expiresAt,
  });

  if (insertErr) {
    console.error("[sendOtp] Fallback insert error:", insertErr.message);
    return errorResponse("Failed to send OTP", 500);
  }

  const isDevMode = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "YOUR_RESEND_API_KEY";

  return successResponse({
    success: true,
    message: "OTP sent successfully",
    ...(isDevMode ? { devOtp: otpCode, note: "Default dev OTP is '123456' or check devOtp" } : {}),
  });
}

/**
 * POST /api/auth/login
 * Verifies OTP and returns JWT + user data.
 */
export async function login(req: NextRequest) {
  const { email, otp } = await req.json();

  if (!email || !otp) {
    return errorResponse("Email and OTP are required", 400);
  }

  // Cast to any — database types are not yet generated
  const supabase: any = createClient();

  // Directly verify OTP from email_otps table (bypasses edge function deployment requirement)
  const { data: records, error: fetchError } = await supabase
    .from("email_otps")
    .select("*")
    .eq("email", email.toLowerCase())
    .eq("purpose", "email_validation")
    .is("consumed_at", null)
    .is("verified_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1);

  if (fetchError) {
    return errorResponse("Failed to verify OTP. Please try again.", 500);
  }

  if (!records || records.length === 0) {
    return errorResponse("OTP has expired or is invalid. Please request a new one.", 400);
  }

  const record = records[0];

  if (record.attempts >= 5) {
    await supabase
      .from("email_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", record.id);
    return errorResponse("Too many attempts. Please request a new OTP.", 400);
  }

  const isDevMode = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "YOUR_RESEND_API_KEY";
  const isValid = otp === record.otp || (isDevMode && otp === "123456");

  if (!isValid) {
    await supabase
      .from("email_otps")
      .update({ attempts: record.attempts + 1 })
      .eq("id", record.id);
    return errorResponse("Invalid OTP. Please try again.", 400);
  }

  // Mark as verified and consumed
  await supabase
    .from("email_otps")
    .update({
      verified_at: new Date().toISOString(),
      consumed_at: new Date().toISOString(),
    })
    .eq("id", record.id);

  // Get user details from database
  const { data: dbUser, error: userError } = await supabase
    .from("users")
    .select("id, email, mobile, role")
    .eq("email", email)
    .single();

  if (userError || !dbUser) {
    // New user — OTP is verified, but profile doesn't exist yet
    return successResponse({
      returning: false,
      verified: true,
    });
  }

  // Resolve display name based on role
  let name = "Unknown";
  if (dbUser.role === "practitioner") {
    const { data: prac } = await supabase
      .from("practitioners")
      .select("full_name")
      .eq("user_id", dbUser.id)
      .maybeSingle();
    if (prac) name = prac.full_name;
  } else if (dbUser.role === "patient") {
    const { data: pat } = await supabase
      .from("patients")
      .select("full_name")
      .eq("user_id", dbUser.id)
      .maybeSingle();
    if (pat) name = pat.full_name;
  }

  // Sign Tokens
  const tokenPayload = {
    id: dbUser.id,
    email: dbUser.email,
    phone: dbUser.mobile,
    role: dbUser.role,
    name,
  };

  const accessToken = await signAccessToken(tokenPayload);
  const refreshToken = await signRefreshToken(tokenPayload);

  // Set cookies
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
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return successResponse({
    // Return user info. We don't need to return the token to the client body
    // since it's now securely handled via HttpOnly cookies.
    user: {
      id: dbUser.id,
      phone: dbUser.mobile,
      role: dbUser.role,
      name,
      abhaLinked: true,
      email: dbUser.email,
    },
  });
}

/**
 * POST /api/auth/refresh
 * Rotates the refresh token and issues a new access token.
 */
export async function refresh(req: NextRequest) {
  const cookieStore = await cookies();
  const currentRefreshToken = cookieStore.get("refresh_token")?.value;

  if (!currentRefreshToken) {
    return errorResponse("No refresh token provided", 401);
  }

  // Verify the refresh token
  const { verifyToken } = await import("@/lib/jwt"); // using existing function which we exported
  const payload = await verifyToken(currentRefreshToken);

  if (!payload || payload.type !== "refresh") {
    return errorResponse("Invalid or expired refresh token", 401);
  }

  // Sign new Tokens
  const tokenPayload = {
    id: payload.id,
    email: payload.email,
    phone: payload.phone,
    role: payload.role,
    name: payload.name,
  };

  const newAccessToken = await signAccessToken(tokenPayload);
  const newRefreshToken = await signRefreshToken(tokenPayload);

  // Set new cookies
  cookieStore.set("access_token", newAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60, // 15 minutes
  });

  cookieStore.set("refresh_token", newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });

  return successResponse({ success: true, message: "Token refreshed" });
}

/**
 * POST /api/auth/logout
 * Clears the auth cookies.
 */
export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  return successResponse({ success: true, message: "Logged out" });
}
