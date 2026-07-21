"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePatientUpcomingCalls } from "@/hooks/use-consultations";
import { useAppointments } from "@/hooks/use-appointments";
import { useNotifications, markNotificationReadApi, markAllNotificationsReadApi, type NotificationRow } from "@/hooks/use-notification";

const TYPE_ICON: Record<string, string> = {
  appointment: "🗓️",
  prescription: "📋",
  medicine: "💊",
  dinacharya: "🌅",
  ai_chat: "✨",
  payment: "💳",
  general: "🔔",
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const { data: notifications, loading, refetch } = useNotifications(user?.id);
  const { data: upcomingCalls } = usePatientUpcomingCalls(user?.id);
  const { data: appointments } = useAppointments(user?.id);
  const [filter, setFilter] = useState<"all" | "unread" | "upcoming" | "expired">("all");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getStartOfDay = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const injectedCalls = (upcomingCalls || []).map((call) => ({
    id: `upcoming-${call.id}`,
    type: "appointment",
    title: "Upcoming Session Fixed",
    body: `Your upcoming appointment is with ${user?.role === 'patient' ? call.practitionerName : call.patientName} on ${call.date} at ${call.time}`,
    isRead: true,
    createdAt: call.createdAt,
    rawDate: call.date,
    timeAgo: "Upcoming",
    deepLink: "/prescription"
  })) as any[];

  const injectedAppointments = (appointments || [])
    .map((appt) => ({
      id: `appt-${appt.id}`,
      type: "appointment",
      title: "Appointment Fixed",
      body: `Your appointment is with ${appt.doctor} on ${appt.date}`,
      isRead: true,
      createdAt: new Date().toISOString(),
      rawDate: appt.dateRaw,
      timeAgo: "Appointment",
      deepLink: "/appointments"
    })) as any[];

  const baseNotifs = (notifications ?? []).map((n) => ({ ...n, rawDate: n.createdAt }));

  const allNotifs = [...injectedCalls, ...injectedAppointments, ...baseNotifs];
  const unreadCount = allNotifs.filter((n) => !n.isRead).length;

  const filtered = allNotifs.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;

    const notifDate = getStartOfDay(n.rawDate || n.createdAt);
    if (!notifDate) return false;

    if (filter === "upcoming") {
      return notifDate.getTime() >= today.getTime();
    }
    if (filter === "expired") {
      return notifDate.getTime() < today.getTime();
    }
    return true;
  });

  filtered.sort((a, b) => {
    const dateA = new Date(a.rawDate || a.createdAt).getTime();
    const dateB = new Date(b.rawDate || b.createdAt).getTime();
    return dateB - dateA;
  });

  async function handleMarkRead(id: string) {
    await markNotificationReadApi(id);
    refetch();
  }

  async function handleMarkAllRead() {
    if (user?.id) {
      await markAllNotificationsReadApi();
      refetch();
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-xl font-semibold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-herb-green font-semibold hover:underline"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted rounded-xl p-1 mb-6 flex-wrap w-full sm:w-fit">
        {(["all", "unread", "upcoming", "expired"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg capitalize transition-all whitespace-nowrap flex-1 sm:flex-none",
              filter === f ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {f}
            {f === "unread" && unreadCount > 0 && (
              <span className="ml-1.5 text-[10px] bg-herb-green/15 text-herb-green font-semibold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-4 h-20 animate-pulse">
              <div className="w-1/3 h-3 bg-muted rounded mb-2" />
              <div className="w-2/3 h-3 bg-muted rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <span className="text-4xl">🔔</span>
          <p className="font-semibold text-foreground mt-3">No notifications</p>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === "unread" ? "No unread notifications" : "Nothing to show in this tab."}
          </p>
        </div>
      )}

      {/* Notification list */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-4">
          {filtered.map((notif: NotificationRow) => (
            <button
              key={notif.id}
              onClick={() => !notif.isRead && handleMarkRead(notif.id)}
              className={cn(
                "group w-full text-left bg-white rounded-2xl border transition-all duration-300 relative overflow-hidden",
                notif.isRead
                  ? "border-border/60 shadow-sm hover:shadow-md hover:border-border"
                  : "border-herb-green/30 shadow-[0_4px_20px_-4px_rgba(27,107,74,0.12)] bg-gradient-to-br from-white to-herb-green/[0.03] hover:shadow-[0_8px_30px_-4px_rgba(27,107,74,0.18)] hover:-translate-y-0.5"
              )}
            >
              <div className="p-5 flex items-start gap-4">
                {/* Icon wrapper */}
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                  notif.isRead ? "bg-muted" : "bg-herb-green/10"
                )}>
                  <span className="text-xl">{TYPE_ICON[notif.type] ?? TYPE_ICON.general}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn(
                      "text-[15px] font-bold truncate transition-colors duration-200",
                      notif.isRead ? "text-muted-foreground group-hover:text-foreground/80" : "text-foreground group-hover:text-herb-green"
                    )}>
                      {notif.title}
                    </p>
                    <span className={cn(
                      "text-[11px] font-semibold flex-shrink-0 px-2 py-0.5 rounded-full border tracking-wide uppercase",
                      notif.isRead ? "text-muted-foreground border-border bg-muted/50" : "text-herb-green border-herb-green/20 bg-herb-green/5"
                    )}>
                      {notif.timeAgo}
                    </span>
                  </div>

                  <p className={cn(
                    "text-sm mt-1.5 leading-relaxed line-clamp-2",
                    notif.isRead ? "text-muted-foreground/80" : "text-muted-foreground"
                  )}>
                    {notif.body}
                  </p>

                  {notif.deepLink && (
                    <div className="mt-3 flex items-center">
                      <Link href={notif.deepLink} className={cn(
                        "text-[12px] font-bold inline-flex items-center gap-1 transition-all duration-200",
                        notif.isRead ? "text-muted-foreground hover:text-foreground" : "text-herb-green hover:text-herb-green/80 group-hover:translate-x-1"
                      )}>
                        View details <span className="text-[14px]">→</span>
                      </Link>
                    </div>
                  )}
                </div>

                {/* Unread indicator */}
                {!notif.isRead && (
                  <div className="absolute top-[26px] right-4 flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-herb-green shadow-[0_0_8px_rgba(27,107,74,0.6)] animate-pulse" />
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
