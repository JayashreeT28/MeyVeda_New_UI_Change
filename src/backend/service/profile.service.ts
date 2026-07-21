import { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { ProfileRepository, type PatientProfileEntity } from "../repo/profile.repo";
import { AuthUser } from "@/shared/auth/auth.types";
import { ForbiddenError, AppError } from "@/shared/api/api-error";

export const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  city: z.string().optional(),
  pinCode: z.string().optional(),
  prakriti: z.string().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ProfileResponse = PatientProfileEntity;

function canReadProfile(authUser: AuthUser, targetUserId: string): boolean {
  if (authUser.role === "admin") return true;
  if (authUser.id === targetUserId) return true;
  if (authUser.role === "doctor") return true;
  return false;
}

function canUpdateProfile(authUser: AuthUser, targetUserId: string): boolean {
  if (authUser.role === "admin") return true;
  if (authUser.id === targetUserId) return true;
  return false;
}

export class ProfileService {
  private repository: ProfileRepository;

  constructor(supabase: SupabaseClient) {
    this.repository = new ProfileRepository(supabase);
  }

  async getProfile(authUser: AuthUser, targetUserId?: string): Promise<ProfileResponse> {
    const userIdToFetch = targetUserId || authUser.id;

    if (!canReadProfile(authUser, userIdToFetch)) {
      throw new ForbiddenError("Cannot access this profile.");
    }

    const profile = await this.repository.getProfileByUserId(userIdToFetch, authUser.role);
    if (!profile) {
      throw new AppError("Profile not found", 404);
    }

    return profile;
  }

  async updateProfile(authUser: AuthUser, updates: UpdateProfileInput, targetUserId?: string): Promise<ProfileResponse> {
    const userIdToUpdate = targetUserId || authUser.id;

    if (!canUpdateProfile(authUser, userIdToUpdate)) {
      throw new ForbiddenError("Cannot update this profile.");
    }

    await this.repository.updateProfile(userIdToUpdate, updates, authUser.role);

    const profile = await this.repository.getProfileByUserId(userIdToUpdate, authUser.role);
    if (!profile) {
      throw new AppError("Profile not found", 404);
    }
    return profile;
  }
}
