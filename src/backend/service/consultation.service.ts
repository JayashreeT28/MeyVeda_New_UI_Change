import "server-only";

import { ConsultationRepository, type SaveCompleteConsultationInput } from "../repo/consultation.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { ForbiddenError, AppError } from "@/shared/api/api-error";

export class ConsultationService {
  static async getDetailedConsultations(authUser: AuthUser): Promise<any[]> {
    if (authUser.role !== "patient") return [];

    const patientId = await ConsultationRepository.getPatientIdFromUserId(authUser.id);
    if (!patientId) return [];

    return ConsultationRepository.getDetailedConsultationsForPatient(patientId);
  }

  static async getConsultationReportData(authUser: AuthUser, consultationId: string): Promise<any> {
    const owner = await ConsultationRepository.getConsultationOwner(consultationId);
    if (!owner) {
      throw new AppError("Consultation not found", 404);
    }

    if (authUser.role !== "admin" && authUser.role !== "super_admin") {
      let authorized = false;

      if (authUser.role === "patient") {
        const patientId = await ConsultationRepository.getPatientIdFromUserId(authUser.id);
        authorized = !!patientId && owner.patient_id === patientId;
      } else if (authUser.role === "doctor" || (authUser.role as string) === "practitioner") {
        const practitionerId = await ConsultationRepository.getPractitionerIdFromUserId(authUser.id);
        authorized = !!practitionerId && owner.practitioner_id === practitionerId;
      }

      if (!authorized) {
        throw new ForbiddenError("You are not authorized to view this consultation report");
      }
    }

    const report = await ConsultationRepository.getConsultationReportData(consultationId);
    if (!report) {
      throw new AppError("Consultation report not found", 404);
    }
    return report;
  }

  static async saveCompleteConsultation(authUser: AuthUser, payload: Omit<SaveCompleteConsultationInput, "practitionerId">): Promise<void> {
    if (authUser.role !== "doctor" && (authUser.role as string) !== "practitioner") {
      throw new ForbiddenError("Only practitioners can record consultations");
    }
    if (!payload.patientId) {
      throw new Error("Patient ID is required");
    }
    if (!payload.vitals) {
      throw new Error("Vitals are required");
    }

    // practitionerId is always the authenticated practitioner, never client-supplied
    await ConsultationRepository.saveCompleteConsultation({ ...payload, practitionerId: authUser.id });
  }

  static async getUpcomingCalls(authUser: AuthUser): Promise<any[]> {
    if (authUser.role === "patient") {
      return ConsultationRepository.getUpcomingCallsForPatient(authUser.id);
    }
    if (authUser.role === "doctor" || (authUser.role as string) === "practitioner") {
      return ConsultationRepository.getUpcomingCallsForPractitioner(authUser.id);
    }
    return [];
  }

  static async getPatientIntakeDetails(authUser: AuthUser, patientId: string): Promise<any> {
    if (authUser.role !== "doctor" && (authUser.role as string) !== "practitioner" && authUser.role !== "admin" && authUser.role !== "super_admin") {
      throw new ForbiddenError("Only practitioners can view patient intake details");
    }
    if (!patientId) {
      throw new Error("Patient ID is required");
    }
    return ConsultationRepository.getPatientIntakeDetails(patientId);
  }
}
