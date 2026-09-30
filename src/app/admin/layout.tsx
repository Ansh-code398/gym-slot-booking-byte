"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { Calendar, PlusCircle, ShieldAlert } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        <div className="loading loading-spinner loading-lg text-primary" />
        <p className="mt-4 text-sm text-base-content/70">Verifying administrator permissions...</p>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
        <ShieldAlert className="w-16 h-16 text-error mb-4" />
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-base-content/70 mb-6">
          This portal is restricted to gym staff and administrators. Your current account does not have admin privileges.
        </p>
        <Link href="/" className="btn btn-primary">
          Return to Home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-base-200/40">
      <div className="bg-base-100 border-b border-base-200 px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="badge badge-primary font-bold">Admin Portal</span>
            <span className="text-sm font-medium text-base-content/80">
              Logged in as <strong className="text-base-content">{user.name}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className={`btn btn-sm ${pathname === "/admin" ? "btn-primary" : "btn-ghost"}`}
            >
              <Calendar className="w-4 h-4 mr-1" />
              All Sessions
            </Link>
            <Link
              href="/admin/create"
              className={`btn btn-sm ${pathname === "/admin/create" ? "btn-primary" : "btn-outline"}`}
            >
              <PlusCircle className="w-4 h-4 mr-1" />
              Create Session
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </div>
    </div>
  );
}