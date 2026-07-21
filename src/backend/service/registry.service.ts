import "server-only";

import { RegistryRepository } from "../repo/registry.repo";
import { AuthUser } from "@/shared/auth/auth.types";

export class RegistryService {
  static async getMyPatients(authUser: AuthUser): Promise<any[]> {
    if (authUser.role !== "doctor" && (authUser.role as string) !== "practitioner") {
      return [];
    }
    return RegistryRepository.getPatientsForPractitioner(authUser.id);
  }
}
