import { describe, expect, it } from "vitest";

import { queryClient } from "@/lib/query-client";

const retry = queryClient.getDefaultOptions().queries?.retry as (
  failureCount: number,
  error: unknown,
) => boolean;

const withStatus = (status: number) => ({ response: { status } });

describe("queryClient retry", () => {
  it.each([401, 403, 404])("gives up at once on a %i, which asking again will not change", (status) => {
    expect(retry(0, withStatus(status))).toBe(false);
  });

  it("retries a server error twice, then stops", () => {
    expect(retry(0, withStatus(500))).toBe(true);
    expect(retry(1, withStatus(500))).toBe(true);
    expect(retry(2, withStatus(500))).toBe(false);
  });

  it("retries a network failure that has no response", () => {
    expect(retry(0, new Error("Network Error"))).toBe(true);
  });
});
