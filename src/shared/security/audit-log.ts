import "server-only";

import { createClient } from "../db/supabase.server";

export type AuditLogEntry = {
  userId: string;
  role: string;
  action: string;
  module: string;
  recordId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
};

// Sensitive keys that must NEVER be logged under any circumstances
const SENSITIVE_KEYS = new Set([
  "password",
  "otp",
  "token",
  "accessToken",
  "refreshToken",
  "access_token",
  "refresh_token",
  "medicalNotes",
  "medical_notes",
  "card",
  "cardNumber",
  "card_number",
  "cvv",
  "serviceRoleKey",
  "service_role_key",
]);

/**
 * Sanitizes metadata by recursively removing sensitive fields.
 */
function sanitizeMetadata(data: any): any {
  if (!data) return data;
  if (typeof data !== "object") return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeMetadata);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase()) || key.includes("password") || key.includes("token")) {
      sanitized[key] = "[REDACTED_SENSITIVE_DATA]";
    } else {
      sanitized[key] = sanitizeMetadata(value);
    }
  }
  return sanitized;
}

/**
 * Writes an entry to the system audit logs.
 * Falls back to structured stdout logging if DB insertions fail or table does not exist.
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const sanitizedMetadata = sanitizeMetadata(entry.metadata);

  const logPayload = {
    user_id: entry.userId,
    role: entry.role,
    action: entry.action,
    module: entry.module,
    record_id: entry.recordId || null,
    ip_address: entry.ipAddress || "unknown",
    user_agent: entry.userAgent || "unknown",
    metadata: sanitizedMetadata || {},
    created_at: new Date().toISOString(),
  };

  // 1. Structured stdout logging (extremely secure, easily collected by Datadog, CloudWatch, Google Cloud Logging)
  console.info(`[AUDIT_LOG] ${JSON.stringify(logPayload)}`);

  // 2. Database logging (via admin client to bypass RLS)
  try {
    const supabase = createClient() as any;
    const { error } = await supabase
      .from("audit_logs")
      .insert([logPayload]);

    if (error) {
      // Table might not exist yet, we catch this and log to console
      if (error.code === "PGRST116" || error.message.includes("does not exist")) {
        console.warn("[AUDIT_LOG] Warning: 'audit_logs' table does not exist in database yet. Log stored in stdout only.");
      } else {
        console.error("[AUDIT_LOG] Database insert failed:", error.message);
      }
    }
  } catch (err: any) {
    console.error("[AUDIT_LOG] Unexpected database logging error:", err?.message || err);
  }
}
