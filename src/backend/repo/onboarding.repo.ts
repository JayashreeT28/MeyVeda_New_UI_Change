import { createClient } from "@/shared/db/supabase.server";

export type SaveDoctorProfileInput = {
  userId: string;
  fullName: string;
  photoUrl?: string;
  signatureUrl?: string;
  consultationFee: number;
  specializations: string[];
  languages: string[];
  degreeUrl: string;
  registrationCertUrl: string;
  hprId?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
};

export type SavePatientProfileInput = {
  userId: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  phone: string;
  email: string;
  address?: string;
  abhaNumber?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  allergies?: string[];
  chronicConditions?: string[];
  currentMedications?: string[];
};

export class OnboardingRepository {
  static async getDoctorProfileByUserId(userId: string): Promise<any | null> {
    const supabase: any = createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[OnboardingRepository] Error loading doctor profile:", error.message);
      return null;
    }
    if (!data) return null;

    // Return in compatible shape expected by frontend
    return {
      ...data,
      consultation_fee: Math.round((data.base_video_fee ?? 0) / 100),
      is_active: data.verification_status === "verified",
      verifications: [
        {
          id: data.id,
          status: data.verification_status,
          rejection_reason: data.rejection_reason,
          degree_url: data.degree_url,
          registration_cert_url: data.registration_cert_url,
          hpr_id: data.hpr_id,
        },
      ],
    };
  }

  static async saveDoctorProfileAndVerification(p: SaveDoctorProfileInput): Promise<void> {
    const supabase: any = createClient();

    // Upsert directly into practitioners table
    const { error: pracErr } = await supabase
      .from("practitioners")
      .upsert(
        {
          user_id: p.userId,
          full_name: p.fullName,
          photo_url: p.photoUrl || null,
          signature_url: p.signatureUrl || null,
          degree_url: p.degreeUrl,
          registration_cert_url: p.registrationCertUrl,
          hpr_id: p.hprId || null,
          date_of_birth: p.dateOfBirth || null,
          gender: p.gender || null,
          blood_group: p.bloodGroup || null,
          specializations: p.specializations,
          disciplines: ["Ayurveda"],
          languages: p.languages,
          qualifications: ["BAMS"],
          base_video_fee: (p.consultationFee || 0) * 100, // paise
          verification_status: "pending",
        },
        { onConflict: "user_id" }
      );

    if (pracErr) {
      console.error("[OnboardingRepository] Error saving practitioner profile:", pracErr.message);
      throw new Error(pracErr.message || "Failed to save practitioner profile");
    }

    // Ensure user role is practitioner
    await supabase.from("users").update({ role: "practitioner" }).eq("id", p.userId);
  }

  static async getPatientProfileByUserId(userId: string): Promise<any | null> {
    const supabase: any = createClient();
    const { data, error } = await supabase
      .from("patient_profiles")
      .select(`
        *,
        family_members:patient_family_members (*)
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[OnboardingRepository] Error loading patient profile:", error.message);
      return null;
    }
    return data;
  }

  static async savePatientProfile(p: SavePatientProfileInput): Promise<void> {
    const supabase: any = createClient();

    await supabase
      .from("users")
      .update({ role: "patient", abha_number: p.abhaNumber || null })
      .eq("id", p.userId);

    const { error } = await supabase.from("patient_profiles").upsert(
      {
        user_id: p.userId,
        full_name: p.fullName,
        date_of_birth: p.dateOfBirth,
        gender: p.gender,
        phone: p.phone,
        email: p.email,
        address: p.address || null,
        abha_number: p.abhaNumber || null,
        emergency_contact_name: p.emergencyContactName || null,
        emergency_contact_phone: p.emergencyContactPhone || null,
        allergies: p.allergies || [],
        chronic_conditions: p.chronicConditions || [],
        currentMedications: p.currentMedications || [],
        is_active: true,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[OnboardingRepository] Error saving patient profile:", error.message);
      throw error;
    }
  }

  static async getVerificationQueue(): Promise<any[]> {
    const supabase: any = createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select(`
        id,
        user_id,
        full_name,
        photo_url,
        signature_url,
        degree_url,
        registration_cert_url,
        hpr_id,
        verification_status,
        rejection_reason,
        base_video_fee,
        specializations,
        languages,
        created_at,
        user:users!practitioners_user_id_fkey (
          email,
          mobile
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OnboardingRepository] Error fetching verification queue:", error.message);
      throw new Error("Failed to fetch verification queue from database");
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      doctor_id: row.id,
      degree_url: row.degree_url,
      registration_cert_url: row.registration_cert_url,
      hpr_id: row.hpr_id,
      status: row.verification_status,
      rejection_reason: row.rejection_reason,
      created_at: row.created_at,
      doctor: {
        id: row.id,
        user_id: row.user_id,
        full_name: row.full_name,
        photo_url: row.photo_url,
        signature_url: row.signature_url,
        consultation_fee: Math.round((row.base_video_fee ?? 0) / 100),
        specializations: row.specializations ?? [],
        languages: row.languages ?? [],
        user: row.user,
      },
    }));
  }

  static async verifyDoctor(
    verificationId: string,
    doctorId: string,
    status: "verified" | "rejected",
    reviewerId: string,
    reason?: string
  ): Promise<void> {
    const supabase: any = createClient();

    const targetId = doctorId || verificationId;
    const updates: Record<string, any> = {
      verification_status: status,
      rejection_reason: reason || null,
    };

    const { data: prac, error: updateErr } = await supabase
      .from("practitioners")
      .update(updates)
      .eq("id", targetId)
      .select("user_id")
      .maybeSingle();

    if (updateErr) {
      console.error("[OnboardingRepository] Error updating practitioner verification:", updateErr.message);
      throw updateErr;
    }

    if (prac?.user_id) {
      await supabase
        .from("users")
        .update({ role: "practitioner" })
        .eq("id", prac.user_id);
    }
  }
}
