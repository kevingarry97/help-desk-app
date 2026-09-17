import { describe, expect, mock, test } from "bun:test";
import type { Response } from "express";
import { z } from "zod/v4";

import { validate } from "./validate";

function fakeResponse() {
  const res = { status: mock(() => res), json: mock(() => res) };
  return res;
}

const schema = z.object({ status: z.enum(["OPEN", "CLOSED"]).optional() });

describe("validate", () => {
  test("hands back the parsed data and writes nothing when the input matches", () => {
    const res = fakeResponse();

    const result = validate(schema, { status: "OPEN", extra: "dropped" }, res as unknown as Response);

    expect(result).toEqual({ ok: true, data: { status: "OPEN" } });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test("answers 400 naming the request body by default, with each issue's path", () => {
    const res = fakeResponse();

    const result = validate(schema, { status: "bogus" }, res as unknown as Response);

    expect(result).toEqual({ ok: false });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid request body",
      issues: [{ path: "status", message: expect.any(String) }],
    });
  });

  test("names the query parameters when validating a query", () => {
    const res = fakeResponse();

    validate(schema, { status: "bogus" }, res as unknown as Response, "query");

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "Invalid query parameters" }),
    );
  });
});
