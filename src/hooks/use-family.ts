"use client";

import { useQuery } from "./useQuery";
import { apiClient } from "@/shared/api/api-client";

export type FamilyMemberRow = {
  id: string;
  name: string;
  relationship: string;
  dob: string;
  age: number;
  gender: string;
  abhaId: string | null;
  prakriti: string | null;
};

export function useFamilyMembers(patientId: string | undefined) {
  return useQuery<FamilyMemberRow[]>(
    async () => {
      if (!patientId) return [];
      const response = await apiClient<{ data: FamilyMemberRow[] }>("/api/family");
      return response.data;
    },
    [patientId]
  );
}

export async function addFamilyMemberApi(member: { fullName: string; relationship: string; dob: string; gender: string; }) {
  return await apiClient("/api/family", {
    method: "POST",
    body: JSON.stringify({ action: "addFamilyMember", payload: { member } }),
  });
}

export async function deleteFamilyMemberApi(id: string) {
  return await apiClient("/api/family", {
    method: "POST",
    body: JSON.stringify({ action: "deleteFamilyMember", payload: { id } }),
  });
}
