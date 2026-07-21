import { createClient } from "@/shared/db/supabase.server";

export class RegistryRepository {
  static async getPractitionerIdFromUserId(userId: string): Promise<string> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.id ?? userId;
  }

  static async getPatientsForPractitioner(practitionerUserId: string): Promise<any[]> {
    const supabase = await createClient();
    const resolvedPractitionerId = await this.getPractitionerIdFromUserId(practitionerUserId);
    const today = new Date().toLocaleDateString("en-CA");
    const appointmentsByPatient: Record<string, any[]> = {};
    const patientsWithAppointmentToday = new Set<string>();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("patient_id, scheduled_date, scheduled_time")
      .eq("practitioner_id", resolvedPractitionerId);

    const ids = (appointments ?? [])
      .map((a: any) => {
        if (a.patient_id) {
          if (!appointmentsByPatient[a.patient_id]) {
            appointmentsByPatient[a.patient_id] = [];
          }
          appointmentsByPatient[a.patient_id].push(a);
          if (a.scheduled_date === today) {
            patientsWithAppointmentToday.add(a.patient_id);
          }
        }
        return a.patient_id;
      })
      .filter(Boolean) as string[];



    const patientIdsFilter = Array.from(new Set(ids));
    if (patientIdsFilter.length === 0) {
      return [];
    }

    const [{ data: legacyPatients, error: patError }, { data: newProfiles, error: profError }] = await Promise.all([
      supabase
        .from("patients")
        .select(`
          id,
          full_name,
          date_of_birth,
          gender,
          prakriti,
          user:users (
            mobile,
            abha_links ( abha_id )
          )
        `)
        .in("id", patientIdsFilter),
      supabase
        .from("patient_profiles")
        .select(`
          id,
          user_id,
          full_name,
          date_of_birth,
          gender,
          phone,
          abha_number
        `)
        .in("user_id", patientIdsFilter),
    ]);

    if (patError || profError) {
      console.error("[RegistryRepository] Error fetching registry patients:", patError || profError);
      throw new Error("Failed to fetch patients from database");
    }

    // Merge the two sources. Prefer legacy if both exist (unlikely), or just use whatever is available.
    const mergedPatientsMap = new Map<string, any>();

    for (const p of legacyPatients || []) {
      mergedPatientsMap.set(p.id, p);
    }

    for (const p of newProfiles || []) {
      if (!mergedPatientsMap.has(p.user_id)) {
        mergedPatientsMap.set(p.user_id, {
          id: p.user_id, // We use user_id here because appointments stores it as patient_id
          full_name: p.full_name,
          date_of_birth: p.date_of_birth,
          gender: p.gender,
          prakriti: "Vata-Pitta", // default for new profiles
          user: { mobile: p.phone, abha_links: p.abha_number ? [{ abha_id: p.abha_number }] : [] },
        });
      }
    }

    const patients = Array.from(mergedPatientsMap.values());

    const { data: fuData } = await supabase
      .from("follow_ups")
      .select("patient_id, recommended_date, booked_appointment_id")
      .eq("practitioner_id", resolvedPractitionerId);
    const followUps = fuData ?? [];

    const followUpsByPatient: Record<string, any[]> = {};
    for (const f of followUps) {
      if (!followUpsByPatient[f.patient_id]) {
        followUpsByPatient[f.patient_id] = [];
      }
      followUpsByPatient[f.patient_id].push(f);
    }

    // Fetch all health records to find vitals, problems, and notes
    const { data: records, error: recError } = await supabase
      .from("health_records")
      .select("*")
      .order("record_date", { ascending: false });

    if (recError) {
      console.error("[RegistryRepository] Error fetching health records:", recError.message);
    }

    const recordsByPatient: Record<string, any[]> = {};
    for (const r of records ?? []) {
      if (!recordsByPatient[r.patient_id]) {
        recordsByPatient[r.patient_id] = [];
      }
      recordsByPatient[r.patient_id].push(r);
    }

    return patients.map((p: any) => {
      let age = 0;
      if (p.date_of_birth) {
        const birthDate = new Date(p.date_of_birth);
        age = new Date().getFullYear() - birthDate.getFullYear();
      }

      const patientRecords = recordsByPatient[p.id] ?? [];

      // Latest vitals
      const vitalsRecord = patientRecords.find((r) => r.title === "Vitals" && r.record_type === "tracker");
      let vitals = null;
      if (vitalsRecord && vitalsRecord.summary) {
        try {
          vitals = JSON.parse(vitalsRecord.summary);
        } catch {
          // Malformed vitals JSON - leave as null
        }
      }

      // Problems
      const problemsRecord = patientRecords.find((r) => r.title === "Problems" && r.record_type === "tracker");
      let problems: any[] = [];
      if (problemsRecord && problemsRecord.summary) {
        try {
          problems = JSON.parse(problemsRecord.summary);
        } catch {
          // Malformed problems JSON - leave as empty
        }
      }

      // Latest visit date & count
      const visits = patientRecords.filter((r) => r.record_type === "consultation");
      const lastVisit = visits[0]?.record_date ?? "No visits";
      let lastVisitDaysAgo = 99;
      if (visits[0]?.record_date) {
        const diffTime = Math.abs(new Date().getTime() - new Date(visits[0].record_date).getTime());
        lastVisitDaysAgo = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }

      const userObj = Array.isArray(p.user) ? p.user[0] : p.user;
      const abhaList = userObj?.abha_links || [];
      const abha = abhaList.length > 0 ? abhaList[0].abha_id : null;

      const patientAppts = appointmentsByPatient[p.id] ?? [];
      const isToday = patientAppts.some((a) => a.scheduled_date === today);

      // Calculate next appointment or follow-up recommendation
      const futureAppts = patientAppts.filter((a) => a.scheduled_date >= today);
      futureAppts.sort((a, b) => {
        const dA = new Date(`${a.scheduled_date}T${a.scheduled_time || "00:00:00"}`).getTime();
        const dB = new Date(`${b.scheduled_date}T${b.scheduled_time || "00:00:00"}`).getTime();
        return dA - dB;
      });

      let nextFollowUp = null;
      if (futureAppts.length > 0) {
        const d = new Date(futureAppts[0].scheduled_date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        
        let t = futureAppts[0].scheduled_time;
        if (t) {
           // convert "14:00:00" to "2:00 PM"
           const [hr, min] = t.split(":");
           let h = parseInt(hr, 10);
           const ampm = h >= 12 ? "PM" : "AM";
           h = h % 12;
           if (h === 0) h = 12;
           t = `${h}:${min} ${ampm}`;
        }
        nextFollowUp = t ? `${d} at ${t}` : d;
      }

      const patientFollowUps = (followUpsByPatient[p.id] ?? []).filter((f) => !f.booked_appointment_id);
      let followUpDue = false;
      
      // If they have an upcoming appointment, they should appear in the Follow-up tab for visibility of upcoming sessions
      if (futureAppts.length > 0) {
         followUpDue = true;
      } else if (patientFollowUps.length > 0) {
        patientFollowUps.sort((a, b) => new Date(a.recommended_date).getTime() - new Date(b.recommended_date).getTime());
        const earliestDue = patientFollowUps[0].recommended_date;
        if (earliestDue) {
          followUpDue = new Date(earliestDue).getTime() <= new Date().getTime();
          if (!nextFollowUp) {
            nextFollowUp = new Date(earliestDue).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            });
          }
        }
      }

      return {
        id: p.id,
        name: p.full_name || "Unknown",
        age,
        gender: p.gender || "Unknown",
        phone: userObj?.mobile || "",
        abha,
        bloodGroup: "O+",
        prakriti: p.prakriti || "Unknown",
        lastVisit: lastVisit !== "No visits" ? new Date(lastVisit).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "No visits",
        lastVisitDaysAgo,
        nextFollowUp,
        followUpDue,
        isToday,
        conditions: problems.map((pr: any) => pr.name).join(" · ") || "No recorded conditions",
        systems: ["Ayurveda"],
        totalVisits: visits.length,
        problems,
        allergySummary: "No known allergies",
        activeMeds: 0,
        vitals,
      };
    });
  }
}
