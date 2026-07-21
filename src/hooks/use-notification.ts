"use client";

import { useQuery } from "./useQuery";
import { apiClient } from "@/shared/api/api-client";

export type NotificationRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  deepLink: string | null;
  createdAt: string;
  timeAgo: string;
};

export function useNotifications(userId: string | undefined) {
  return useQuery<NotificationRow[]>(
    async () => {
      if (!userId) return [];
      const response = await apiClient<{ data: NotificationRow[] }>("/api/notification");
      return response.data;
    },
    [userId]
  );
}

export async function markNotificationReadApi(id: string) {
  return await apiClient("/api/notification", {
    method: "POST",
    body: JSON.stringify({ action: "markNotificationRead", payload: { id } }),
  });
}

export async function markAllNotificationsReadApi() {
  return await apiClient("/api/notification", {
    method: "POST",
    body: JSON.stringify({ action: "markAllNotificationsRead", payload: {} }),
  });
}
