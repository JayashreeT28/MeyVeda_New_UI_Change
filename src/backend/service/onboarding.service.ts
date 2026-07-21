import "server-only";

import { OnboardingRepository, type SaveDoctorProfileInput, type SavePatientProfileInput } from "../repo/onboarding.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { ForbiddenError } from "@/shared/api/api-error";

function assertAdmin(authUser: AuthUser): void {
  if (authUser.role !== "admin" && authUser.role !== "super_admin") {
    throw new ForbiddenError("Admin access required");
  }
}

export class OnboardingService {
  static async getDoctorProfile(userId: string) {
    return OnboardingRepository.getDoctorProfileByUserId(userId);
  }

  static async saveDoctorProfile(input: SaveDoctorProfileInput): Promise<void> {
    if (!input.fullName?.trim()) throw new Error("Full name is required");
    if (!input.degreeUrl) throw new Error("Degree document is required");
    if (!input.registrationCertUrl) throw new Error("Registration certificate is required");
    await OnboardingRepository.saveDoctorProfileAndVerification(input);
  }

  static async getPatientProfile(userId: string) {
    return OnboardingRepository.getPatientProfileByUserId(userId);
  }

  static async savePatientProfile(input: SavePatientProfileInput): Promise<void> {
    if (!input.fullName?.trim()) throw new Error("Full name is required");
    if (!input.dateOfBirth) throw new Error("Date of birth is required");
    await OnboardingRepository.savePatientProfile(input);
  }

  static async getVerificationQueue(authUser: AuthUser) {
    assertAdmin(authUser);
    return OnboardingRepository.getVerificationQueue();
  }

  static async verifyDoctor(
    authUser: AuthUser,
    verificationId: string,
    doctorId: string,
    status: "verified" | "rejected",
    reason?: string
  ): Promise<void> {
    assertAdmin(authUser);
    if (!verificationId || !doctorId) throw new Error("Verification ID and doctor ID are required");
    if (status === "rejected" && !reason?.trim()) throw new Error("A rejection reason is required");
    await OnboardingRepository.verifyDoctor(verificationId, doctorId, status, authUser.id, reason);
  }
}
