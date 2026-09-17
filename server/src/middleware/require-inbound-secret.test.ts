import { describe, expect, test } from "bun:test";

import { secretMatches } from "./require-inbound-secret";

const SECRET = "s".repeat(40);

describe("secretMatches", () => {
  test("accepts the secret as a bearer token", () => {
    expect(secretMatches(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  test.each([
    ["a wrong token of the same length", `Bearer ${"t".repeat(40)}`],
    ["a prefix of the secret", `Bearer ${SECRET.slice(0, 39)}`],
    ["the secret with extra characters", `Bearer ${SECRET}x`],
    ["a missing header", undefined],
    ["an empty header", ""],
    ["a bare token with no scheme", SECRET],
    ["another scheme", `Basic ${SECRET}`],
    ["a lowercase scheme", `bearer ${SECRET}`],
    ["a scheme with no token", "Bearer "],
  ])("refuses %s", (_label, header) => {
    expect(secretMatches(header, SECRET)).toBe(false);
  });
});
