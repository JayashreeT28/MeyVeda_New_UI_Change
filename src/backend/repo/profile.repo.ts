import { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/shared/api/api-error";

export type PatientProfileEntity = {
  id: string;
  name: string;
  email: string;
  phone: string;
  dob: string;
  age: number;
  gender: string;
  bloodGroup?: string;
  city: string;
  pinCode: string;
  prakriti: string;
  wellnessGoals: string[];
  abhaId: string | null;
  abhaAddress: string | null;
  address?: string;
};

export type UpdateProfileFields = {
  fullName?: string;
  dob?: string;
  gender?: string;
  bloodGroup?: string;
  city?: string;
  pinCode?: string;
  email?: string;
  phone?: string;
  prakriti?: string;
};

export class ProfileRepository {
  constructor(private supabase: SupabaseClient) {}

  async getProfileByUserId(userId: string, role?: string): Promise<PatientProfileEntity | null> {
    if (role === "practitioner" || role === "doctor") {
      const { data: prac, error: pracError } = await this.supabase
        .from("practitioners")
        .select(`
          id, full_name, date_of_birth, gender, blood_group, city,
          user:users!practitioners_user_id_fkey ( id, mobile, email )
        `)
        .eq("user_id", userId)
        .maybeSingle();

      if (pracError) {
        console.error("Error fetching practitioner profile:", pracError);
      }

      if (prac) {
        const user = Array.isArray(prac.user) ? prac.user[0] : prac.user;
        let age = 0;
        if (prac.date_of_birth) age = new Date().getFullYear() - new Date(prac.date_of_birth).getFullYear();
        return {
          id: prac.id,
          name: prac.full_name ?? "",
          email: (user as any)?.email ?? "",
          phone: (user as any)?.mobile ?? "",
          dob: prac.date_of_birth ?? "",
          age,
          gender: prac.gender ?? "",
          bloodGroup: prac.blood_group ?? "",
          city: prac.city ?? "",
          pinCode: "",
          prakriti: "Unknown",
          wellnessGoals: [],
          abhaId: null,
          abhaAddress: null,
          address: "",
        };
      }
    }

    const { data: pat, error } = await this.supabase
      .from("patients")
      .select(`
        id, full_name, date_of_birth, gender, city, pin_code, prakriti, wellness_goals, address,
        user:users (
          id, mobile, email,
          abha:abha_links ( abha_id, abha_address )
        )
      `)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new AppError("Database error while fetching profile", 500);
    }
    if (!pat) return null;

    const user = Array.isArray(pat.user) ? pat.user[0] : pat.user;
    const abhaObj = (user as any)?.abha;
    const abha = Array.isArray(abhaObj) ? abhaObj[0] : abhaObj;
    let age = 0;
    if (pat.date_of_birth) age = new Date().getFullYear() - new Date(pat.date_of_birth).getFullYear();

    return {
      id: pat.id,
      name: pat.full_name ?? "",
      email: (user as any)?.email ?? "",
      phone: (user as any)?.mobile ?? "",
      dob: pat.date_of_birth ?? "",
      age,
      gender: pat.gender ?? "",
      city: pat.city ?? "",
      pinCode: pat.pin_code ?? "",
      prakriti: pat.prakriti ?? "Unknown",
      wellnessGoals: pat.wellness_goals ?? [],
      abhaId: (abha as any)?.abha_id ?? null,
      abhaAddress: (abha as any)?.abha_address ?? null,
      address: (pat as any).address ?? "",
    };
  }

  async updateProfile(userId: string, updates: UpdateProfileFields, role?: string): Promise<void> {
    const tableUpdates: Record<string, unknown> = {};
    if (updates.fullName) tableUpdates.full_name = updates.fullName;
    if (updates.dob) tableUpdates.date_of_birth = updates.dob;
    if (updates.gender) tableUpdates.gender = updates.gender.toLowerCase();
    if (updates.bloodGroup) tableUpdates.blood_group = updates.bloodGroup;
    if (updates.city) tableUpdates.city = updates.city;

    const tableName = (role === "practitioner" || role === "doctor") ? "practitioners" : "patients";

    if (tableName === "patients") {
      if (updates.pinCode) tableUpdates.pin_code = updates.pinCode;
      if (updates.prakriti) tableUpdates.prakriti = updates.prakriti;
    }

    if (Object.keys(tableUpdates).length > 0) {
      const { error } = await this.supabase.from(tableName).update(tableUpdates).eq("user_id", userId);
      if (error) {
        throw new AppError(`Database error while updating profile in ${tableName}`, 500);
      }
    }

    if (updates.email || updates.phone) {
      const userUpdates: Record<string, unknown> = {};
      if (updates.email) userUpdates.email = updates.email;
      if (updates.phone) userUpdates.mobile = updates.phone;

      const { error } = await this.supabase.from("users").update(userUpdates).eq("id", userId);
      if (error) {
        throw new AppError("Database error while updating profile user details", 500);
      }
    }
  }
}
