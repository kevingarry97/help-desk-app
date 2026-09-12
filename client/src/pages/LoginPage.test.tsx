import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";

import LoginPage from "@/pages/LoginPage";

vi.mock("@/lib/auth-client", () => ({
  signIn: { email: vi.fn() },
  useSession: vi.fn(),
}));

const { signIn, useSession } = await import("@/lib/auth-client");
const signInEmail = vi.mocked(signIn.email);
const mockSession = vi.mocked(useSession);

function renderLogin(initialEntry: string | { pathname: string; state: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry as never]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<h1>Dashboard</h1>} />
        <Route path="/users" element={<h1>Users</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  signInEmail.mockReset();
  mockSession.mockReset();
  mockSession.mockReturnValue({ data: null, isPending: false } as never);
});

describe("LoginPage", () => {
  describe("the form's inputs", () => {
    it("labels both fields, so they are reachable by name", () => {
      renderLogin();

      expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Password/)).toBeInTheDocument();
    });

    it("masks the password and hints the right autofill for each field", () => {
      renderLogin();

      expect(screen.getByLabelText(/Password/)).toHaveAttribute("type", "password");
      expect(screen.getByLabelText(/Email/)).toHaveAttribute("autocomplete", "email");
      expect(screen.getByLabelText(/Password/)).toHaveAttribute(
        "autocomplete",
        "current-password",
      );
    });

    it("accepts what the user types", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.type(screen.getByLabelText(/Password/), "hunter2");

      expect(screen.getByLabelText(/Email/)).toHaveValue("admin@example.com");
      expect(screen.getByLabelText(/Password/)).toHaveValue("hunter2");
    });
  });

  describe("validation", () => {
    it("rejects a malformed email without calling the API", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "not-an-email");
      await user.type(screen.getByLabelText(/Password/), "hunter2");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
      expect(signInEmail).not.toHaveBeenCalled();
    });

    it("requires a password", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Enter your password")).toBeInTheDocument();
      expect(signInEmail).not.toHaveBeenCalled();
    });

    it("reports both fields at once on an empty submit", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
      expect(screen.getByText("Enter your password")).toBeInTheDocument();
    });

    it("marks an invalid field for assistive tech, not just visually", async () => {
      const user = userEvent.setup();
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "not-an-email");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() =>
        expect(screen.getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true"),
      );
    });
  });

  describe("submitting", () => {
    it("sends exactly what was typed", async () => {
      const user = userEvent.setup();
      signInEmail.mockResolvedValue({ error: null } as never);
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.type(screen.getByLabelText(/Password/), "hunter2");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await waitFor(() =>
        expect(signInEmail).toHaveBeenCalledWith({
          email: "admin@example.com",
          password: "hunter2",
        }),
      );
    });

    it("shows a generic message for a rejected credential, without saying which half was wrong", async () => {
      const user = userEvent.setup();
      signInEmail.mockResolvedValue({ error: { status: 401 } } as never);
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.type(screen.getByLabelText(/Password/), "wrong");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    });

    it("surfaces a non-401 failure rather than swallowing it", async () => {
      const user = userEvent.setup();
      signInEmail.mockResolvedValue({
        error: { status: 429, message: "Too many requests" },
      } as never);
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.type(screen.getByLabelText(/Password/), "hunter2");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    });

    it("stays on the form after a failure so the attempt can be retried", async () => {
      const user = userEvent.setup();
      signInEmail.mockResolvedValue({ error: { status: 401 } } as never);
      renderLogin();

      await user.type(screen.getByLabelText(/Email/), "admin@example.com");
      await user.type(screen.getByLabelText(/Password/), "wrong");
      await user.click(screen.getByRole("button", { name: "Sign in" }));

      await screen.findByRole("alert");

      expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    });
  });

  describe("when a session already exists", () => {
    it("redirects away instead of showing the form again", async () => {
      mockSession.mockReturnValue({ data: { user: { name: "Ada" } }, isPending: false } as never);

      renderLogin();

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Password/)).not.toBeInTheDocument();
    });

    it("returns to the route the visitor was bounced from", async () => {
      mockSession.mockReturnValue({ data: { user: { name: "Ada" } }, isPending: false } as never);

      renderLogin({ pathname: "/login", state: { from: { pathname: "/users" } } });

      expect(await screen.findByRole("heading", { name: "Users" })).toBeInTheDocument();
    });

    it("ignores an external redirect target and goes home instead", async () => {
      mockSession.mockReturnValue({ data: { user: { name: "Ada" } }, isPending: false } as never);

      // An open-redirect attempt: the guard only ever writes in-app locations here, but the
      // check costs one line and this is what it is for.
      renderLogin({ pathname: "/login", state: { from: { pathname: "//evil.com" } } });

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    });
  });
});
