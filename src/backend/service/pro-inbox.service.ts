import "server-only";

import { ProInboxRepository, type InboxThread } from "../repo/pro-inbox.repo";
import { AuthUser } from "@/shared/auth/auth.types";

export class ProInboxService {
  static async getInbox(authUser: AuthUser): Promise<InboxThread[]> {
    if (authUser.role !== "doctor" && (authUser.role as string) !== "practitioner") {
      return [];
    }

    const practitionerId = await ProInboxRepository.getPractitionerIdFromUserId(authUser.id);
    if (!practitionerId) return [];

    return ProInboxRepository.getInboxForPractitioner(practitionerId);
  }
}
