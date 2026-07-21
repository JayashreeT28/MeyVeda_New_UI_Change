import { NextRequest } from "next/server";
import { AppointmentsService, createAppointmentSchema, cancelAppointmentSchema } from "../service/appointments.service";
import { requireAuth } from "@/shared/auth/require-auth";
import { requirePermission } from "@/shared/auth/require-permission";
import { PERMISSIONS } from "@/shared/security/permissions";
import { apiSuccess } from "@/shared/api/api-response";
import { ValidationError } from "@/shared/api/api-error";
import { writeAuditLog } from "@/shared/security/audit-log";

/**
 * Handles GET /api/appointments
 * Retrieves appointments list filtered by the user's role and identity.
 */
export async function getAppointmentsController(req: NextRequest) {
  // 1. Authenticate user
  const auth = await requireAuth(req);

  // 2. Enforce read permission
  requirePermission(auth, PERMISSIONS.APPOINTMENTS_READ);

  // 3. Fetch appointments
  const appointments = await AppointmentsService.getAppointmentsForUser(auth);

  return apiSuccess(appointments);
}

/**
 * Handles POST /api/appointments
 * Creates/schedules a new appointment.
 */
export async function createAppointmentController(req: NextRequest) {
  // 1. Authenticate user
  const auth = await requireAuth(req);

  // 2. Enforce create permission
  requirePermission(auth, PERMISSIONS.APPOINTMENTS_CREATE);

  // 3. Parse and validate body
  const body = await req.json();
  const parsed = createAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Validation failed", parsed.error.format());
  }

  // 4. Create appointment
  const result = await AppointmentsService.createAppointment(
    auth,
    parsed.data.slotId,
    parsed.data.mode,
    parsed.data.reasonForVisit
  );

  // 5. Secure audit log
  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "create_appointment",
    module: "appointments",
    recordId: result.id,
    ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
    metadata: { slotId: parsed.data.slotId, mode: parsed.data.mode },
  });

  return apiSuccess(result, "Appointment scheduled successfully", 201);
}

/**
 * Handles DELETE/Cancel appointment
 * Expects { appointmentId, reason } in payload.
 */
export async function cancelAppointmentController(req: NextRequest) {
  // 1. Authenticate user
  const auth = await requireAuth(req);

  // 2. Enforce delete permission
  requirePermission(auth, PERMISSIONS.APPOINTMENTS_DELETE);

  // 3. Parse and validate body
  const body = await req.json();
  const parsed = cancelAppointmentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Validation failed", parsed.error.format());
  }

  // 4. Cancel appointment with ownership validation inside service
  await AppointmentsService.cancelAppointment(
    auth,
    parsed.data.appointmentId,
    parsed.data.reason
  );

  // 5. Secure audit log
  await writeAuditLog({
    userId: auth.id,
    role: auth.role,
    action: "cancel_appointment",
    module: "appointments",
    recordId: parsed.data.appointmentId,
    ipAddress: req.headers.get("x-forwarded-for") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
    metadata: { reason: parsed.data.reason },
  });

  return apiSuccess(null, "Appointment cancelled successfully");
}
