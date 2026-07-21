import { createClient } from "@/shared/db/supabase.server";
import { AppError } from "@/shared/api/api-error";

export class NotificationRepository {
  static async getNotifications(userId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new AppError("Error fetching notifications", 500);
    return data;
  }

  static async markNotificationRead(id: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw new AppError("Error marking notification read", 500);
  }

  static async markAllNotificationsRead(userId: string) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw new AppError("Error marking all notifications read", 500);
  }
}
