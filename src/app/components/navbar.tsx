"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import {
  Menu,
  X,
  Dumbbell,
  QrCode,
  Shield,
  LogOut,
  LogIn,
  UserPlus,
  User,
} from "lucide-react";

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [prevPathname, setPrevPathname] = useState(pathname);

   if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-40 bg-base-100/95 backdrop-blur-md border-b border-base-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 group focus:outline-none"
              aria-label="Gym Home"
            >
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-content transition-colors">
                <Dumbbell className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight">GYM</span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className={`btn btn-sm ${
                  isActive("/") ? "btn-primary" : "btn-ghost"
                } gap-2 font-medium`}
              >
                <Dumbbell className="w-4 h-4" />
                <span>Booking Slots</span>
              </Link>

              {user && (
                <Link
                  href="/my-bookings"
                  className={`btn btn-sm ${
                    isActive("/my-bookings") ? "btn-primary" : "btn-ghost"
                  } gap-2 font-medium`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>My Bookings</span>
                </Link>
              )}

              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`btn btn-sm ${
                    isActive("/admin") ? "btn-primary" : "btn-ghost"
                  } gap-2 font-medium`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Portal</span>
                </Link>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <span className="loading loading-spinner loading-sm text-primary" />
            ) : !user ? (
              <div className="flex items-center gap-2">
                <Link href="/login" className="btn btn-ghost btn-sm gap-1.5 font-medium">
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link href="/signup" className="btn btn-primary btn-sm gap-1.5">
                  <UserPlus className="w-4 h-4" />
                  <span>Sign Up</span>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-base-200/60 border border-base-200">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {user.name ? user.name[0].toUpperCase() : <User className="w-3.5 h-3.5" />}
                  </div>
                  <div className="text-left text-xs leading-tight">
                    <div className="font-semibold text-base-content truncate max-w-[130px]">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-base-content/60 capitalize">
                      {user.role}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="btn btn-ghost btn-outline btn-error btn-sm gap-1.5"
                  title="Sign out of your account"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            {user && (
              <div
                className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs border border-primary/20"
                title={`${user.name} (${user.role})`}
              >
                {user.name ? user.name[0].toUpperCase() : <User className="w-4 h-4" />}
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileOpen(!mobileOpen)}
              className="btn btn-ghost btn-sm btn-square"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-base-200 bg-base-100 px-4 pt-3 pb-5 space-y-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          {user ? (
            <div className="p-3 rounded-xl bg-base-200/60 border border-base-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm">
                  {user.name ? user.name[0].toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div>
                  <div className="font-bold text-sm leading-snug">{user.name}</div>
                  <div className="text-xs text-base-content/60">{user.email}</div>
                </div>
              </div>
              <span
                className={`badge badge-sm font-semibold capitalize ${
                  user.role === "admin" ? "badge-primary" : "badge-ghost"
                }`}
              >
                {user.role}
              </span>
            </div>
          ) : (
            <div className="text-xs text-base-content/60 px-1">
              Welcome to Gym! Sign in to book workout sessions.
            </div>
          )}

          <div className="flex flex-col gap-1">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive("/")
                  ? "bg-primary text-primary-content font-bold shadow-xs"
                  : "hover:bg-base-200 text-base-content/80"
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>Booking Slots</span>
            </Link>

            {user && (
              <Link
                href="/my-bookings"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/my-bookings")
                    ? "bg-primary text-primary-content font-bold shadow-xs"
                    : "hover:bg-base-200 text-base-content/80"
                }`}
              >
                <QrCode className="w-4 h-4" />
                <span>My Bookings & Passes</span>
              </Link>
            )}

            {user?.role === "admin" && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive("/admin")
                    ? "bg-primary text-primary-content font-bold shadow-xs"
                    : "hover:bg-base-200 text-base-content/80"
                }`}
              >
                <Shield className="w-4 h-4" />
                <span>Admin Portal</span>
              </Link>
            )}
          </div>

          <div className="pt-2 border-t border-base-200">
            {loading ? (
              <div className="flex justify-center p-2">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            ) : user ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  logout();
                }}
                className="btn btn-outline btn-error btn-sm w-full gap-2 justify-center"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-outline btn-primary btn-sm w-full gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="btn btn-primary btn-sm w-full gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}