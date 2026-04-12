import { NavLink, Outlet } from "react-router-dom";
import { UserButton } from "@clerk/clerk-react";

const nav = [
  { to: "/", label: "🏠 Today" },
  { to: "/roles", label: "🎭 Roles" },
  { to: "/goals", label: "🎯 Goals" },
  { to: "/tasks", label: "✅ Tasks" },
  { to: "/inbox", label: "✨ Capture" },
  { to: "/finance", label: "💰 Finance" },
  { to: "/wishlist", label: "🛒 Wishlist" },
  { to: "/timeline", label: "📜 Timeline" },
];

export default function Layout() {
  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-5 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-indigo-600 tracking-tight">
            Life OS
          </span>
        </div>
        <nav className="flex-1 py-4 space-y-1 px-3">
          {nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-2">
          <UserButton afterSignOutUrl="/sign-in" />
          <span className="text-xs text-gray-500">Account</span>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
