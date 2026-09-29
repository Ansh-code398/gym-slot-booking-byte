"use client";

import Link from "next/link";
import { useAuth } from "@/context/auth-context";

export default function Navbar() {
  const { user, loading, logout } = useAuth();

  return (
    <div className="navbar bg-base-100 shadow-sm px-4">
      <div className="navbar-start">
        <Link href="/" className="btn btn-ghost text-xl">
          <span className="font-bold">GYM</span>
        </Link>
      </div>

      <div className="navbar-end">
        {loading ? (
          <div className="loading loading-spinner loading-sm" />
        ) : !user ? (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn btn-secondary btn-sm">
              Sign In
            </Link>
            <Link href="/signup" className="btn btn-primary btn-sm">
              Sign Up
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {user.role === "admin" && (
              <Link href="/admin" className="btn btn-primary btn-sm">
                Admin Portal
              </Link>
            )}
            <div className="text-right hidden sm:block">
              <div className="font-semibold text-sm">{user.name}</div>
              <div className="text-xs opacity-60 capitalize">{user.role}</div>
            </div>
            <button
              onClick={() => logout()}
              className="btn btn-outline btn-error btn-sm"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}