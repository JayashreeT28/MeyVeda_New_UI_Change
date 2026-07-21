"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [otpMode, setOtpMode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const stats = {
    totalPractitioners: 0,
    totalClinics: 0,
    totalPatients: 0,
    totalMedicines: 0,
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setTimeout(() => {
      setCountdown((c) => Math.max(c - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("mv_admin");
      if (stored) router.replace("/admin/dashboard");
    } catch { }
  }, [router]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || "Failed to send OTP.");
      }
      setOtp(Array(6).fill(""));
      setOtpMode(true);
      setCountdown(300);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 0);
    } catch (err: any) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  }

  function handleOtpInput(index: number, value: string) {
    const numericValue = value.replace(/\D/g, "");
    setOtp((currentOtp) => {
      const nextOtp = [...currentOtp];
      nextOtp[index] = numericValue;
      return nextOtp;
    });
    if (numericValue && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: otp.join("") }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success === false) throw new Error(data?.error || data?.message || "Failed to verify OTP.");
      const dbUser = data?.data?.user;
      if (!dbUser || (dbUser.role !== "super_admin" && dbUser.role !== "clinic_admin" && dbUser.role !== "intern_staff")) {
        throw new Error("Unauthorised. Admin access required.");
      }
      localStorage.setItem("mv_admin", JSON.stringify({ name: dbUser.name || "Admin", email: dbUser.email, role: dbUser.role, loginAt: new Date().toISOString() }));
      window.location.replace("/admin/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to verify OTP.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-clinical-dark flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-herb-green flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-white font-semibold text-lg tracking-tight">MeyVeda</span>
            <span className="text-xs bg-herb-green/20 text-herb-green px-2 py-0.5 rounded-full font-semibold">Admin</span>
          </div>
          <div className="mt-16">
            <h1 className="text-white text-4xl font-display font-bold leading-tight">
              Platform<br />Control Centre
            </h1>
            <p className="text-white/50 mt-4 text-sm leading-relaxed max-w-sm">
              Manage practitioners, hospitals, patients, medicines, and the entire MeyVeda ecosystem from one place.
            </p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {[
              { label: "Practitioners", value: stats.totalPractitioners },
              { label: "Hospitals", value: stats.totalClinics },
              { label: "Patients", value: stats.totalPatients },
              { label: "Medicines", value: stats.totalMedicines },
            ].map((s) => (
              <div key={s.label} className="bg-white/5 rounded-2xl p-4">
                <p className="text-white font-bold text-xl font-display">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-white/20 text-xs">© 2026 MeyVeda · Trivine Tech Solutions</p>
      </div>

      {/* Right login panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-xl bg-herb-green flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="font-semibold text-foreground">MeyVeda Admin</span>
          </div>

          <h2 className="font-display text-2xl font-bold text-foreground">Admin Sign In</h2>
          <p className="text-sm text-muted-foreground mt-1">Restricted access — authorised personnel only</p>

          <form onSubmit={otpMode ? handleVerifyOtp : handleSendOtp} className="mt-8 space-y-4">
            {!otpMode ? (
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@meyveda.com"
                  required
                  className="w-full px-3.5 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-herb-green/20 focus:border-herb-green/50 bg-white placeholder:text-muted-foreground transition-all disabled:opacity-60"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-semibold text-foreground">Enter 6-digit OTP</label>
                  <button type="button" disabled={loading} onClick={() => { setOtpMode(false); setOtp(Array(6).fill("")); setCountdown(0); setError(""); }} className="text-[11px] text-herb-green hover:underline disabled:opacity-60">Change email</button>
                </div>
                <div className="flex justify-center gap-2.5 mb-1">
                  {otp.map((digit, index) => (
                    <input key={index} id={`otp-${index}`} type="text" inputMode="numeric" maxLength={1} value={digit} disabled={loading} onChange={(e) => handleOtpInput(index, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(index, e)} className={`h-14 w-11 rounded-2xl border bg-background text-center font-mono text-xl font-bold shadow-sm transition-all duration-200 focus:scale-105 focus:outline-none focus:ring-4 focus:ring-herb-green/15 disabled:cursor-not-allowed disabled:opacity-60 ${digit ? "border-2 border-herb-green bg-herb-green/5" : "border-border hover:border-muted-foreground/30 focus:border-herb-green"}`} />
                  ))}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] text-muted-foreground">{countdown > 0 ? `Expires in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : "OTP Expired"}</span>
                  {countdown === 0 && <button type="button" disabled={loading} onClick={(e) => handleSendOtp(e as unknown as React.FormEvent)} className="text-[11px] font-medium text-herb-green hover:underline disabled:opacity-60">Resend OTP</button>}
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (otpMode && otp.join("").length !== 6)}
              className="w-full py-3 bg-herb-green text-white font-semibold rounded-xl hover:bg-herb-green/90 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            >
              {loading ? "Processing…" : otpMode ? "Verify & Sign In" : "Send OTP"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
