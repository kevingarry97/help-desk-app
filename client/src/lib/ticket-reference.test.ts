import { describe, expect, it } from "vitest";

import { ticketReference } from "@/lib/ticket-reference";

describe("ticketReference", () => {
  it("is a hash and the id's last six characters, upper-cased", () => {
    expect(ticketReference("cmu4lc5zn0000lkscw7tqd5dw")).toBe("#TQD5DW");
  });

  it("uses the whole id when it is shorter than six characters", () => {
    expect(ticketReference("t42")).toBe("#T42");
  });
});
