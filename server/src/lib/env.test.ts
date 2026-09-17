import { describe, expect, test } from "bun:test";

import { MIN_SECRET_LENGTH, readSecret } from "./env";

const LONG = "s".repeat(MIN_SECRET_LENGTH);
const SHORT = "s".repeat(MIN_SECRET_LENGTH - 1);

describe("readSecret", () => {
  describe("required", () => {
    test("returns a secret of the minimum length", () => {
      expect(readSecret("SECRET", { required: true }, { SECRET: LONG })).toBe(LONG);
    });

    test.each([
      ["unset", {}],
      ["empty", { SECRET: "" }],
    ])("refuses to boot when %s, naming the variable", (_label, env) => {
      expect(() => readSecret("SECRET", { required: true }, env)).toThrow("SECRET is not set");
    });

    test("refuses to boot on a short secret, saying how long it is", () => {
      expect(() => readSecret("SECRET", { required: true }, { SECRET: SHORT })).toThrow(
        `SECRET is ${SHORT.length} characters long; it must be at least ${MIN_SECRET_LENGTH}`,
      );
    });
  });

  describe("optional", () => {
    test("returns a secret of the minimum length", () => {
      expect(readSecret("SECRET", {}, { SECRET: LONG })).toBe(LONG);
    });

    test.each([
      ["unset", {}],
      ["empty", { SECRET: "" }],
    ])("is undefined when %s, so the feature is off", (_label, env) => {
      expect(readSecret("SECRET", {}, env)).toBeUndefined();
    });

    test("still refuses to boot on a short secret, and says it can be left empty", () => {
      expect(() => readSecret("SECRET", {}, { SECRET: SHORT })).toThrow(
        "or leave it empty to turn the feature off",
      );
    });
  });

  test("reads process.env when no env is passed", () => {
    process.env.READ_SECRET_TEST = LONG;

    try {
      expect(readSecret("READ_SECRET_TEST", { required: true })).toBe(LONG);
    } finally {
      delete process.env.READ_SECRET_TEST;
    }
  });
});
