import { createClient } from "@/shared/db/supabase.server";

export type MessageRow = {
  id: string;
  consultationId: string;
  senderName: string;
  direction: string;
  content: string;
  sentAt: string;
  isRead: boolean;
};

export class MessageRepository {
  static async getPatientIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("patients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[MessageRepository] Error resolving patient_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getPractitionerIdFromUserId(userId: string): Promise<string | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("practitioners")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("[MessageRepository] Error resolving practitioner_id:", error.message);
      return null;
    }
    return data?.id ?? null;
  }

  static async getConsultationParticipants(consultationId: string): Promise<{ patient_id: string; practitioner_id: string } | null> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("consultations")
      .select("patient_id, practitioner_id")
      .eq("id", consultationId)
      .maybeSingle();

    if (error) {
      console.error("[MessageRepository] Error fetching consultation:", error.message);
      return null;
    }
    return data;
  }

  static async getMessagesForConsultation(consultationId: string): Promise<MessageRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("bounded_messages")
      .select("id, consultation_id, direction, content, sent_at, read_at, sender:users ( id )")
      .eq("consultation_id", consultationId)
      .order("sent_at", { ascending: true });

    if (error) {
      console.error("[MessageRepository] Error fetching messages:", error.message);
      throw new Error("Failed to fetch messages from database");
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      consultationId: row.consultation_id,
      senderName: row.direction === "patient_to_doctor" ? "You" : "Doctor",
      direction: row.direction,
      content: row.content ?? "",
      sentAt: row.sent_at ? new Date(row.sent_at).toLocaleString("en-IN") : "",
      isRead: !!row.read_at,
    }));
  }

  static async sendMessage(params: {
    consultationId: string;
    senderUserId: string;
    direction: "doctor_to_patient" | "patient_to_doctor";
    content: string;
  }): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase.from("bounded_messages").insert({
      consultation_id: params.consultationId,
      sender_user_id: params.senderUserId,
      direction: params.direction,
      content: params.content,
    });

    if (error) {
      console.error("[MessageRepository] Error sending message:", error.message);
      throw new Error("Failed to send message");
    }
  }
}
