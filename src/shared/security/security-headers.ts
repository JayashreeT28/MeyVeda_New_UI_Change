import { NextResponse } from "next/server";

/**
 * Applies security headers to a Next.js NextResponse object.
 * Protects the client app from clickjacking, MIME sniffing, and cross-site scripting.
 */
export function applySecurityHeaders(res: NextResponse): NextResponse {
  // 1. Clickjacking protection (X-Frame-Options)
  res.headers.set("X-Frame-Options", "DENY");

  // 2. MIME sniffing protection (X-Content-Type-Options)
  res.headers.set("X-Content-Type-Options", "nosniff");

  // 3. Referrer Policy
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // 4. Strict Transport Security (enforced in production)
  if (process.env.NODE_ENV === "production") {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // 5. Permissions Policy (restricts camera/microphone access, video room page handles this dynamically)
  res.headers.set(
    "Permissions-Policy",
    "geolocation=(), microphone=*, camera=*, display-capture=*"
  );

  return res;
}
