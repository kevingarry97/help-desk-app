import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";

import AdminRoute from "@/components/AdminRoute";
import ProtectedRoute from "@/components/ProtectedRoute";

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn() }));

const { useSession } = await import("@/lib/auth-client");
const mockSession = vi.mocked(useSession);

const PENDING = { data: null, isPending: true };
const ANONYMOUS = { data: null, isPending: false };
const asAgent = { data: { user: { name: "Ada", role: "agent" } }, isPending: false };
const asAdmin = { data: { user: { name: "Ada", role: "admin" } }, isPending: false };

/** The spinner has no text or role of its own; it is the only thing that animates. */
const spinner = (container: HTMLElement) => container.querySelector(".animate-spin");

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<h1>Sign in</h1>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<h1>Dashboard</h1>} />
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<h1>Users</h1>} />
          </Route>
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => mockSession.mockReset());

describe("ProtectedRoute", () => {
  it("shows a spinner while the session is still resolving", () => {
    mockSession.mockReturnValue(PENDING as never);

    const { container } = renderAt("/");

    // Deciding before the session resolves would bounce a signed-in user to /login on every
    // cold load, so the pending state must render neither outcome.
    expect(spinner(container)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("redirects an anonymous visitor to /login", () => {
    mockSession.mockReturnValue(ANONYMOUS as never);

    renderAt("/");

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("renders the route once a session exists", () => {
    mockSession.mockReturnValue(asAgent as never);

    const { container } = renderAt("/");

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(spinner(container)).not.toBeInTheDocument();
  });
});

describe("AdminRoute", () => {
  it("shows a spinner while the session is still resolving", () => {
    mockSession.mockReturnValue(PENDING as never);

    // Mounted without ProtectedRoute around it. Nested, the outer guard renders its own
    // spinner first and this assertion would pass even with AdminRoute's pending branch
    // deleted — it would be testing ProtectedRoute twice.
    const { container } = render(
      <MemoryRouter initialEntries={["/users"]}>
        <Routes>
          <Route path="/" element={<h1>Dashboard</h1>} />
          <Route element={<AdminRoute />}>
            <Route path="/users" element={<h1>Users</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(spinner(container)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Users" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("sends an agent back to the dashboard", () => {
    mockSession.mockReturnValue(asAgent as never);

    renderAt("/users");

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Users" })).not.toBeInTheDocument();
  });

  it("lets an admin through", () => {
    mockSession.mockReturnValue(asAdmin as never);

    renderAt("/users");

    expect(screen.getByRole("heading", { name: "Users" })).toBeInTheDocument();
  });

  it("does not treat an anonymous visitor as an admin", () => {
    mockSession.mockReturnValue(ANONYMOUS as never);

    renderAt("/users");

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
