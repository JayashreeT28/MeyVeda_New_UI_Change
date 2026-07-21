import { createClient } from "@/shared/db/supabase.server";

export type AppointmentDbRow = {
  id: string;
  mode: string;
  status: string;
  reason_for_visit: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  duration_min: number | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  slot: { fee: number | null } | { fee: number | null }[] | null;
  practitioner: {
    id: string;
    full_name: string | null;
    specializations: string[] | null;
    disciplines: string[] | null;
  } | {
    id: string;
    full_name: string | null;
    specializations: string[] | null;
    disciplines: string[] | null;
  }[] | null;
  consultation: {
    id: string;
    rating: { stars: number | null } | { stars: number | null }[] | null;
  } | {
    id: string;
    rating: { stars: number | null } | { stars: number | null }[] | null;
  }[] | null;
};

const APPOINTMENT_SELECT = `
  id, mode, status, reason_for_visit,
  scheduled_date, scheduled_time, duration_min,
  cancellation_reason, cancelled_at,
  slot:slots ( fee ),
  practitioner:practitioners (
    id, full_name, specializations, disciplines
  ),
  consultation:consultations (
    id,
    rating:ratings ( stars )
  )
`;

export class AppointmentsRepository {
  static async getPatientIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[AppointmentsRepository] Error resolving patient_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getDoctorIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[AppointmentsRepository] Error resolving practitioner id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getAppointmentsForPatient(patientId: string): Promise<AppointmentDbRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("patient_id", patientId)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error("[AppointmentsRepository] Error fetching appointments for patient:", error.message);
      throw new Error("Failed to fetch appointments from database");
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  static async getAppointmentsForDoctor(doctorProfileId: string): Promise<AppointmentDbRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("doctor_profile_id", doctorProfileId)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error("[AppointmentsRepository] Error fetching appointments for doctor:", error.message);
      throw new Error("Failed to fetch doctor appointments from database");
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  static async getAllAppointments(): Promise<AppointmentDbRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .order("scheduled_date", { ascending: false })
      .order("scheduled_time", { ascending: false });

    if (error) {
      console.error("[AppointmentsRepository] Error fetching all appointments for admin:", error.message);
      throw new Error("Failed to fetch all appointments from database");
    }

    return (data ?? []) as unknown as AppointmentDbRow[];
  }

  static async getAppointmentById(appointmentId: string): Promise<{
    id: string;
    patient_id: string;
    practitioner_id: string;
    doctor_profile_id: string;
    status: string;
  } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("appointments")
      .select("id, patient_id, practitioner_id, doctor_profile_id, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (error) {
      console.error("[AppointmentsRepository] Error fetching appointment by ID:", error.message);
      return null;
    }
    return data;
  }

  static async cancelAppointment(appointmentId: string, reason: string): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from("appointments")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", appointmentId);

    if (error) {
      console.error("[AppointmentsRepository] Error cancelling appointment:", error.message);
      throw new Error("Failed to update cancellation state in database");
    }
  }

  static async createAppointment(
    patientId: string,
    slotId: string,
    mode: string,
    reasonForVisit?: string
  ): Promise<{ id: string }> {
    const supabase = await createClient();

    // Fetch slot detail to find practitioner id & date
    const { data: slot, error: slotError } = await supabase
      .from("slots")
      .select("practitioner_id, date, start_time, duration_min")
      .eq("id", slotId)
      .maybeSingle();

    if (slotError || !slot) {
      console.error("[AppointmentsRepository] Slot error or missing:", slotError?.message);
      throw new Error("Selected appointment slot is invalid or unavailable");
    }

    const { data, error } = await supabase
      .from("appointments")
      .insert({
        patient_id: patientId,
        doctor_profile_id: slot.practitioner_id,
        scheduled_date: slot.date,
        scheduled_time: slot.start_time,
        duration_min: slot.duration_min || 30,
        mode: mode,
        status: "scheduled",
        reason_for_visit: reasonForVisit || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[AppointmentsRepository] Create appointment error:", error.message);
      throw new Error("Database error while registering appointment schedule");
    }

    return data;
  }
}
