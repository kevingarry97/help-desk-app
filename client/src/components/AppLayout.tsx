import { Outlet } from "react-router";

import Navbar from "@/components/Navbar";

/** Chrome shared by every authenticated page: the navbar plus the page container. */
export default function AppLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <Navbar />

      <main className="mx-auto max-w-6xl px-5 py-10">
        <Outlet />
      </main>
    </div>
  );
}
