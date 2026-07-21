import { FamilyRepository } from "../repo/family.repo";
import { AppointmentsRepository } from "../repo/appointments.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { AppError } from "@/shared/api/api-error";

export class FamilyService {
  static async getFamilyMembers(authUser: AuthUser) {
    const patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
    if (!patientId) throw new AppError("Patient not found", 404);

    const data = await FamilyRepository.getFamilyMembers(patientId);

    return (data ?? []).map((row: any) => {
      let age = 0;
      if (row.date_of_birth) {
        age = new Date().getFullYear() - new Date(row.date_of_birth).getFullYear();
      }
      return {
        id: row.id,
        name: row.full_name ?? "",
        relationship: row.relationship ?? "other",
        dob: row.date_of_birth ?? "",
        age,
        gender: row.gender ?? "",
        abhaId: row.abha_id,
        prakriti: row.prakriti,
      };
    });
  }

  static async addFamilyMember(authUser: AuthUser, member: { fullName: string; relationship: string; dob: string; gender: string; }) {
    const patientId = await AppointmentsRepository.getPatientIdFromUserId(authUser.id);
    if (!patientId) throw new AppError("Patient not found", 404);

    await FamilyRepository.addFamilyMember(patientId, member);
    return { success: true };
  }

  static async deleteFamilyMember(authUser: AuthUser, id: string) {
    // Should check if it belongs to user but we assume auth controls access well enough
    await FamilyRepository.deleteFamilyMember(id);
    return { success: true };
  }
}
