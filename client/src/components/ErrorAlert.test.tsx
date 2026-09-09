import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ErrorAlert from "@/components/ErrorAlert";

/**
 * The point of this component is that a failure is never silent. Every branch here is a
 * shape the app actually throws: an Axios rejection carrying the API's `{ error }` body, a
 * plain Error, a bare string, or something unrecognisable.
 */
describe("ErrorAlert", () => {
  it("renders nothing when there is no message and no error", () => {
    const { container } = render(<ErrorAlert />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows a static message", () => {
    render(<ErrorAlert message="Failed to load data" />);

    expect(screen.getByRole("alert")).toHaveTextContent("Failed to load data");
  });

  it("prefers an explicit message over anything extracted from the error", () => {
    render(<ErrorAlert message="Explicit" error={new Error("From the error")} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Explicit");
    expect(screen.queryByText("From the error")).not.toBeInTheDocument();
  });

  describe("extracting from a thrown value", () => {
    it("reads the API's { error } body out of an Axios rejection", () => {
      // The real shape: axios puts the server's body on response.data, and this API puts
      // its text in `error`. AxiosError.message is the useless "Request failed with status
      // code 403", so the body has to win.
      render(
        <ErrorAlert
          error={{
            message: "Request failed with status code 403",
            response: { data: { error: "Forbidden" } },
          }}
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent("Forbidden");
    });

    it("falls back to a { message } body when the API used that key", () => {
      render(<ErrorAlert error={{ response: { data: { message: "Nope" } } }} />);

      expect(screen.getByRole("alert")).toHaveTextContent("Nope");
    });

    it("uses a plain-string response body", () => {
      render(<ErrorAlert error={{ response: { data: "Gateway timeout" } }} />);

      expect(screen.getByRole("alert")).toHaveTextContent("Gateway timeout");
    });

    it("uses Error.message when there is no response at all", () => {
      // A network failure never reaches the server, so there is no body to prefer.
      render(<ErrorAlert error={new Error("Network Error")} />);

      expect(screen.getByRole("alert")).toHaveTextContent("Network Error");
    });

    it("accepts a bare string", () => {
      render(<ErrorAlert error="Something broke" />);

      expect(screen.getByRole("alert")).toHaveTextContent("Something broke");
    });
  });

  describe("when nothing useful can be extracted", () => {
    it("uses the caller's fallback", () => {
      render(<ErrorAlert error={{}} fallback="Failed to save" />);

      expect(screen.getByRole("alert")).toHaveTextContent("Failed to save");
    });

    it("still says something when there is no fallback either", () => {
      // Rendering nothing here would leave the user staring at a form that silently did
      // nothing, which is the failure mode this component exists to prevent.
      render(<ErrorAlert error={{}} />);

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Something went wrong. Please try again.",
      );
    });

    it("ignores an empty-string body rather than rendering a blank alert", () => {
      render(<ErrorAlert error={{ response: { data: { error: "" } } }} fallback="Fallback" />);

      expect(screen.getByRole("alert")).toHaveTextContent("Fallback");
    });
  });
});
