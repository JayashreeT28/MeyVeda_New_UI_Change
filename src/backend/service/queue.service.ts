import "server-only";

import { QueueRepository } from "../repo/queue.repo";
import { AuthUser } from "@/shared/auth/auth.types";

async function resolveMyPractitionerId(authUser: AuthUser): Promise<string | null> {
  if (authUser.role !== "doctor" && (authUser.role as string) !== "practitioner") {
    return null;
  }
  return QueueRepository.getPractitionerIdFromUserId(authUser.id);
}

export class QueueService {
  static async getTodayQueue(authUser: AuthUser): Promise<any[]> {
    const practitionerId = await resolveMyPractitionerId(authUser);
    if (!practitionerId) return [];
    return QueueRepository.getTodayQueue(practitionerId);
  }

  static async getUpcomingAppointments(authUser: AuthUser): Promise<any[]> {
    const practitionerId = await resolveMyPractitionerId(authUser);
    if (!practitionerId) return [];
    return QueueRepository.getUpcomingAppointments(practitionerId);
  }
}
