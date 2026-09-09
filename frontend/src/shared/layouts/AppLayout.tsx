import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/shared/components/Sidebar";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
      <div className="app-shell">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="main-shell">
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
