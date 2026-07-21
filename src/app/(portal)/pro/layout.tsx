"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function ProLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  // Do not show the back button on the main practitioner dashboard
  const isDashboard = pathname === "/pro" || pathname === "/pro/";

  return (
    <div className="flex flex-col min-h-full bg-[#F8FAFC]">
      {!isDashboard && (
        <div className="pt-6 px-6 lg:px-8 max-w-[1200px] w-full mx-auto pb-0">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-indigo-600 transition-colors w-fit bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-sm hover:shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      )}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
