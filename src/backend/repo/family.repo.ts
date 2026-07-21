import { createClient } from "@/shared/db/supabase.server";
import { AppError } from "@/shared/api/api-error";

export class FamilyRepository {
  static async getFamilyMembers(patientId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("family_members")
      .select("*")
      .eq("owner_patient_id", patientId)
      .order("created_at", { ascending: true });

    if (error) throw new AppError("Error fetching family members", 500);
    return data;
  }

  static async addFamilyMember(patientId: string, member: { fullName: string; relationship: string; dob: string; gender: string; }) {
    const supabase = await createClient();
    const { error } = await supabase.from("family_members").insert({
      owner_patient_id: patientId,
      full_name: member.fullName,
      relationship: member.relationship,
      date_of_birth: member.dob,
      gender: member.gender,
    });
    if (error) throw new AppError("Error adding family member", 500);
  }

  static async deleteFamilyMember(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("family_members").delete().eq("id", id);
    if (error) throw new AppError("Error deleting family member", 500);
  }
}
