import { createClient } from "@/shared/db/supabase.server";

function formatTime(timeStr: string): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hours = parseInt(h, 10);
  const period = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 || 12;
  return `${h12}:${m} ${period}`;
}

export class QueueRepository {
  static async getPractitionerIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[QueueRepository] Error resolving practitioner_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getTodayQueue(practitionerId: string): Promise<any[]> {
    const supabase = await createClient();
    const today = new Date().toLocaleDateString("en-CA");

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        mode,
        status,
        reason_for_visit,
        scheduled_time,
        checked_in_at,
        patient:patients (
          id,
          full_name,
          date_of_birth,
          user:users (
            abha_links ( abha_id )
          )
        ),
        patient_profile:patient_profiles (
          id,
          full_name,
          date_of_birth,
          abha_number
        )
      `)
      .eq("practitioner_id", practitionerId)
      .eq("scheduled_date", today)
      .order("scheduled_time", { ascending: true });

    if (error) {
      console.error("[QueueRepository] Error fetching queue:", error.message);
      throw new Error("Failed to fetch today's queue from database");
    }

    return (appointments || []).map((appt: any) => {
      const patient = appt.patient || {};
      const profile = appt.patient_profile || {};

      const userObj = Array.isArray(patient.user) ? patient.user[0] : patient.user;
      const abhaList = userObj?.abha_links || [];
      const abhaId = abhaList.length > 0 ? abhaList[0].abha_id : profile.abha_number;

      const fullName = patient.full_name || profile.full_name || "Unknown";
      const dob = patient.date_of_birth || profile.date_of_birth;

      let age = 0;
      if (dob) {
        const birthDate = new Date(dob);
        const todayDate = new Date();
        age = todayDate.getFullYear() - birthDate.getFullYear();
      }

      let waitMins = 0;
      if (appt.checked_in_at && appt.status === "checked_in") {
        const checkedInTime = new Date(appt.checked_in_at).getTime();
        waitMins = Math.floor((Date.now() - checkedInTime) / 60000);
      } else if (appt.status === "scheduled") {
        const [hours, minutes] = appt.scheduled_time.split(":");
        const scheduledTime = new Date();
        scheduledTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
        const diff = Math.floor((Date.now() - scheduledTime.getTime()) / 60000);
        waitMins = diff > 0 ? diff : 0;
      }

      let mappedStatus = "waiting";
      if (appt.status === "checked_in") mappedStatus = "checked-in";
      else if (appt.status === "in_session") mappedStatus = "in-session";
      else if (appt.status === "completed") mappedStatus = "completed";

      return {
        id: patient.id || profile.id,
        appointmentId: appt.id,
        name: fullName,
        age,
        time: formatTime(appt.scheduled_time),
        mode: appt.mode,
        status: mappedStatus,
        waitMins: Math.max(0, waitMins),
        reason: appt.reason_for_visit || "Consultation",
        abha: abhaId,
      };
    });
  }

  static async getUpcomingAppointments(practitionerId: string): Promise<any[]> {
    const supabase = await createClient();
    const today = new Date().toLocaleDateString("en-CA");

    const { data: appointments, error } = await supabase
      .from("appointments")
      .select(`
        id,
        mode,
        status,
        reason_for_visit,
        scheduled_date,
        scheduled_time,
        patient:patients (
          id,
          full_name,
          date_of_birth,
          gender
        ),
        patient_profile:patient_profiles (
          id,
          full_name,
          date_of_birth,
          gender
        )
      `)
      .eq("practitioner_id", practitionerId)
      .gte("scheduled_date", today)
      .in("status", ["scheduled", "rescheduled", "checked_in"])
      .order("scheduled_date", { ascending: true })
      .order("scheduled_time", { ascending: true })
      .limit(20);

    if (error) {
      console.error("[QueueRepository] Error fetching upcoming appointments:", error.message);
      throw new Error("Failed to fetch upcoming appointments from database");
    }

    const todayDate = new Date();

    return (appointments || []).map((appt: any) => {
      const patient = appt.patient || {};
      const profile = appt.patient_profile || {};

      const fullName = patient.full_name || profile.full_name || "Unknown";
      const dob = patient.date_of_birth || profile.date_of_birth;
      const gender = patient.gender || profile.gender || "";

      let age = 0;
      if (dob) {
        age = todayDate.getFullYear() - new Date(dob).getFullYear();
      }
      const isToday = appt.scheduled_date === today;
      const dateObj = new Date(appt.scheduled_date);
      const dateLabel = isToday
        ? "Today"
        : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", weekday: "short" });

      return {
        appointmentId: appt.id,
        patientId: patient.id || profile.id,
        name: fullName,
        age,
        gender,
        date: appt.scheduled_date,
        dateLabel,
        time: formatTime(appt.scheduled_time),
        mode: appt.mode,
        status: appt.status,
        reason: appt.reason_for_visit || "Consultation",
        isToday,
      };
    });
  }
}
