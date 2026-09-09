import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import Navbar from "@/components/Navbar";

vi.mock("@/lib/auth-client", () => ({ useSession: vi.fn(), signOut: vi.fn() }));

const { useSession, signOut } = await import("@/lib/auth-client");
const mockSession = vi.mocked(useSession);
const mockSignOut = vi.mocked(signOut);

const asAgent = { data: { user: { name: "Grace Hopper", role: "agent" } }, isPending: false };
const asAdmin = { data: { user: { name: "Ada Lovelace", role: "admin" } }, isPending: false };

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/" element={<Navbar />} />
        <Route path="/login" element={<h1>Sign in</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockSession.mockReset();
  mockSignOut.mockReset();
});

describe("Navbar", () => {
  it("shows who is signed in, and their role", () => {
    mockSession.mockReturnValue(asAdmin as never);

    renderNavbar();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  describe("the admin-only Users link", () => {
    it("is offered to an admin", () => {
      mockSession.mockReturnValue(asAdmin as never);

      renderNavbar();

      expect(screen.getByRole("link", { name: "Users" })).toBeInTheDocument();
    });

    it("is withheld from an agent", () => {
      mockSession.mockReturnValue(asAgent as never);

      renderNavbar();

      // Asserted after something that always renders, so this cannot pass merely because
      // the navbar has not mounted yet.
      expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Users" })).not.toBeInTheDocument();
    });
  });

  describe("signing out", () => {
    it("navigates to /login once the server confirms", async () => {
      const user = userEvent.setup();
      mockSession.mockReturnValue(asAdmin as never);
      mockSignOut.mockResolvedValue({ error: null } as never);

      renderNavbar();
      await user.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    });

    it("stays put and reports the failure when sign-out is refused", async () => {
      const user = userEvent.setup();
      mockSession.mockReturnValue(asAdmin as never);
      mockSignOut.mockResolvedValue({ error: { message: "Network Error" } } as never);

      renderNavbar();
      await user.click(screen.getByRole("button", { name: /Sign out/ }));

      // Navigating on a failed sign-out would bounce straight back off LoginPage, which
      // redirects away whenever the session is still live — an infinite loop for the user.
      expect(await screen.findByRole("alert")).toHaveTextContent("Network Error");
      expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
    });

    it("reports a thrown error too, not just a returned one", async () => {
      const user = userEvent.setup();
      mockSession.mockReturnValue(asAdmin as never);
      mockSignOut.mockRejectedValue(new Error("Connection refused"));

      renderNavbar();
      await user.click(screen.getByRole("button", { name: /Sign out/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Connection refused");
    });

    it("re-enables the button after a failure so it can be retried", async () => {
      const user = userEvent.setup();
      mockSession.mockReturnValue(asAdmin as never);
      mockSignOut.mockResolvedValue({ error: { message: "Network Error" } } as never);

      renderNavbar();
      await user.click(screen.getByRole("button", { name: /Sign out/ }));

      await screen.findByRole("alert");
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /Sign out/ })).toBeEnabled(),
      );
    });
  });
});
