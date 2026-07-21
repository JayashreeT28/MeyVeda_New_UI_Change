import "server-only";

import { z } from "zod";
import { AppointmentsRepository, type AppointmentDbRow } from "../repo/appointments.repo";
import { AuthUser } from "@/shared/auth/auth.types";

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_session"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled";

export type AppointmentMode = "video" | "clinic";

export type AppointmentRow = {
  id: string;
  doctor: string;
  practitionerId: string;
  consultationId?: string;
  initials: string;
  specialty: string;
  date: string;
  dateRaw: string;
  mode: AppointmentMode;
  status: "upcoming" | "past" | "cancelled";
  fee: string;
  duration?: string;
  rating?: number;
  hasPrescription?: boolean;
  reason?: string;
  refunded?: boolean;
  reminder: boolean;
};

export const createAppointmentSchema = z.object({
  slotId: z.string().uuid("Invalid Slot ID format"),
  reasonForVisit: z.string().max(1000, "Reason description is too long").optional(),
  mode: z.enum(["video", "clinic"]),
});

export const cancelAppointmentSchema = z.object({
  appointmentId: z.string().uuid("Invalid Appointment ID format"),
  reason: z.string().min(5, "Cancellation reason must be at least 5 characters long").max(500, "Reason is too long"),
});

export const appointmentIdParamSchema = z.object({
  id: z.string().uuid("Invalid Appointment Route ID format"),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

function fmtTime(timeStr?: string | null): string {
  if (!timeStr) return "00:00 AM";
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10);
  const m = parts[1] ?? "00";
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${m} ${period}`;
}

export class AppointmentsService {
  static async getAppointmentsForUser(authUser: AuthUser): Promise<AppointmentRow[]> {
    let rawData: AppointmentDbRow[] = [];

    if (authUser.role === "patient") {
      const patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
      if (!patientId) return [];
      rawData = await AppointmentsRepository.getAppointmentsForPatient(patientId);
    } else if (authUser.role === "doctor" || (authUser.role as string) === "practitioner") {
      const doctorProfileId = await AppointmentsRepository.getDoctorIdFromUserId(authUser.id);
      if (!doctorProfileId) return [];
      rawData = await AppointmentsRepository.getAppointmentsForDoctor(doctorProfileId);
    } else if (authUser.role === "admin" || authUser.role === "super_admin") {
      rawData = await AppointmentsRepository.getAllAppointments();
    } else {
      return []; // Other roles see nothing by default
    }

    return this.mapDbRowsToUI(rawData);
  }

  static async cancelAppointment(
    authUser: AuthUser,
    appointmentId: string,
    reason: string
  ): Promise<void> {
    // 1. Fetch appointment details
    const appointment = await AppointmentsRepository.getAppointmentById(appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    // 2. Validate Ownership
    let authorized = false;

    if (authUser.role === "admin" || authUser.role === "super_admin") {
      authorized = true;
    } else if (authUser.role === "patient") {
      const patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
      if (patientId && appointment.patient_id === patientId) {
        authorized = true;
      }
    } else if (authUser.role === "doctor" || (authUser.role as string) === "practitioner") {
      const doctorProfileId = await AppointmentsRepository.getDoctorIdFromUserId(authUser.id);
      if (doctorProfileId && appointment.doctor_profile_id === doctorProfileId) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw new Error("You are not authorized to cancel this appointment");
    }

    if (appointment.status === "cancelled") {
      throw new Error("Appointment is already cancelled");
    }

    // 3. Execute database change
    await AppointmentsRepository.cancelAppointment(appointmentId, reason);
  }

  static async createAppointment(
    authUser: AuthUser,
    slotId: string,
    mode: string,
    reasonForVisit?: string
  ): Promise<{ id: string }> {
    let patientId: string | null = null;

    if (authUser.role === "patient") {
      patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
    } else if (authUser.role === "admin" || authUser.role === "super_admin") {
      // Admin could schedule for a specific patient, but for this simple route
      // we assume they fall back to mapping themselves or a stub patient.
      // In production, admin booking accepts a direct patient_id target.
      patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
    }

    if (!patientId) {
      throw new Error("A valid registered patient profile is required to schedule an appointment");
    }

    const newAppt = await AppointmentsRepository.createAppointment(
      patientId,
      slotId,
      mode,
      reasonForVisit
    );

    return { id: newAppt.id };
  }

  private static mapDbRowsToUI(rawData: AppointmentDbRow[]): AppointmentRow[] {
    return rawData.map((row: AppointmentDbRow) => {
      const pracArr = Array.isArray(row.practitioner) ? row.practitioner : row.practitioner ? [row.practitioner] : [];
      const prac = pracArr[0] ?? {};
      const name = prac.full_name ?? "Unknown Doctor";
      const initials = name
        .split(" ")
        .filter((w: string) => w)
        .map((w: string) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();

      const specs = [...(prac.specializations ?? []), ...(prac.disciplines ?? [])];

      const slotArr = Array.isArray(row.slot) ? row.slot : row.slot ? [row.slot] : [];
      const slot = slotArr[0];
      const fee = slot?.fee ? `₹${Math.round(slot.fee / 100)}` : "—";

      const dateObj = new Date(row.scheduled_date + "T" + (row.scheduled_time ?? "00:00"));
      const isToday = row.scheduled_date === new Date().toISOString().split("T")[0];
      const dateStr = isToday
        ? `Today, ${fmtTime(row.scheduled_time)}`
        : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
          " · " +
          fmtTime(row.scheduled_time);

      let status: "upcoming" | "past" | "cancelled" = "upcoming";
      if (row.status === "completed") status = "past";
      else if (row.status === "cancelled" || row.status === "no_show") status = "cancelled";
      else if (["scheduled", "checked_in", "in_session", "rescheduled"].includes(row.status)) {
        status = "upcoming";
      }

      const consultArr = Array.isArray(row.consultation) ? row.consultation : row.consultation ? [row.consultation] : [];
      const consult = consultArr[0];
      const ratingObj = consult?.rating;
      const ratingArr = Array.isArray(ratingObj) ? ratingObj : ratingObj ? [ratingObj] : [];

      return {
        id: row.id,
        doctor: name,
        practitionerId: prac.id ?? "",
        consultationId: consult?.id,
        initials,
        specialty: specs.join(" · ") || "AYUSH",
        date: dateStr,
        dateRaw: row.scheduled_date,
        mode: (row.mode as "video" | "clinic") || "video",
        status,
        fee,
        duration: row.duration_min ? `${row.duration_min} min` : undefined,
        rating: ratingArr[0]?.stars ?? undefined,
        hasPrescription: consultArr.length > 0,
        reason: row.cancellation_reason ?? undefined,
        refunded: row.status === "cancelled",
        reminder: false,
      };
    });
  }
}
