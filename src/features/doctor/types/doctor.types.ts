/**
 * Practitioner/Doctor-related types.
 */
import type { AYUSHDiscipline } from "@/types/common.types";

export interface Practitioner {
  id: string;
  name: string;
  specialty: string;
  discipline: AYUSHDiscipline;
  experience: number;
  rating: number;
  reviews: number;
  fee: number;
  hprId: string;
  isVerified: boolean;
  avatar: string;
  languages: string[];
  consultModes: ("video" | "clinic")[];
  nextAvailable: string;
  location: string;
  qualifications: string[];
  about: string;
  clinicFee?: number;
  slotDuration?: number;
  bufferMin?: number;
}

export type ReviewRow = {
  id: string;
  stars: number;
  text: string;
  patientName: string;
  date: string;
};
