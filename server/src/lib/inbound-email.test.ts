import { describe, expect, test } from "bun:test";
import { inboundEmailSchema, type InboundEmailInput } from "core/schemas/inbound-email";

import {
  BODY_MAX,
  NO_BODY,
  NO_SUBJECT,
  SUBJECT_MAX,
  TRUNCATED_MARKER,
  htmlToText,
  toTicketData,
} from "./inbound-email";

const email = (overrides: Partial<InboundEmailInput> = {}): InboundEmailInput => ({
  from: "jane@example.com",
  subject: "Cannot log in",
  text: "I get an error.",
  ...overrides,
});

describe("inboundEmailSchema from", () => {
  const parseFrom = (from: string) => inboundEmailSchema.safeParse({ from });

  test("accepts a bare address", () => {
    expect(parseFrom("jane@example.com").data?.from).toBe("jane@example.com");
  });

  test("extracts the address from a display name", () => {
    expect(parseFrom("Jane Doe <jane@example.com>").data?.from).toBe("jane@example.com");
  });

  test("takes the last bracketed part when the display name contains brackets", () => {
    expect(parseFrom('"a <b@c.com>" <real@example.com>').data?.from).toBe("real@example.com");
  });

  test("lowercases the address and trims around it", () => {
    expect(parseFrom("  Jane <Jane.Doe@Example.COM >  ").data?.from).toBe(
      "jane.doe@example.com",
    );
  });

  test.each(["not an address", "Jane <>", ""])("refuses %p, naming the field", (from) => {
    const result = parseFrom(from);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["from"]);
  });
});

describe("toTicketData", () => {
  test("carries the sender, subject and text through", () => {
    expect(toTicketData(email())).toEqual({
      subject: "Cannot log in",
      body: "I get an error.",
      requesterEmail: "jane@example.com",
      messageId: null,
    });
  });

  test.each([undefined, null, "", "   \n\t "])("uses a placeholder for subject %p", (subject) => {
    expect(toTicketData(email({ subject })).subject).toBe(NO_SUBJECT);
  });

  test("collapses folded whitespace in the subject", () => {
    expect(toTicketData(email({ subject: "Re:\r\n  refund\tplease " })).subject).toBe(
      "Re: refund please",
    );
  });

  test("truncates a long subject", () => {
    const { subject } = toTicketData(email({ subject: "x".repeat(SUBJECT_MAX + 50) }));

    expect(subject).toBe("x".repeat(SUBJECT_MAX));
  });

  test("prefers the text part over the HTML part", () => {
    const { body } = toTicketData(email({ text: "plain", html: "<p>rich</p>" }));

    expect(body).toBe("plain");
  });

  test("falls back to the HTML part when the text part is blank", () => {
    const { body } = toTicketData(email({ text: "  ", html: "<p>Hello</p><p>World</p>" }));

    expect(body).toBe("Hello\nWorld");
  });

  test.each([
    [undefined, undefined],
    ["", ""],
    [" ", "<style>p { color: red }</style>"],
  ])("uses a placeholder when text %p and html %p have no content", (text, html) => {
    expect(toTicketData(email({ text, html })).body).toBe(NO_BODY);
  });

  test("keeps a body at the limit whole", () => {
    const text = "y".repeat(BODY_MAX);

    expect(toTicketData(email({ text })).body).toBe(text);
  });

  test("truncates a body over the limit and marks it", () => {
    const { body } = toTicketData(email({ text: "y".repeat(BODY_MAX + 1) }));

    expect(body).toBe("y".repeat(BODY_MAX) + TRUNCATED_MARKER);
  });

  test.each([
    ["<abc@mail.example.com>", "abc@mail.example.com"],
    ["  abc@mail.example.com ", "abc@mail.example.com"],
    ["< abc@mail.example.com >", "abc@mail.example.com"],
    ["", null],
    ["<>", null],
    [undefined, null],
  ])("normalises message id %p to %p", (messageId, expected) => {
    expect(toTicketData(email({ messageId })).messageId).toBe(expected);
  });
});

describe("htmlToText", () => {
  test("drops script, style, head and comments", () => {
    const html =
      "<html><head><title>T</title></head><body><!-- hidden -->" +
      "<script>alert('x')</script><style>.a{}</style><p>Visible</p></body></html>";

    expect(htmlToText(html)).toBe("Visible");
  });

  test("turns breaks and block ends into lines, ignoring source whitespace", () => {
    const html = "<div>One\n   two</div><div>Three<br>Four<br/>Five</div><ul><li>a</li><li>b</li></ul>";

    expect(htmlToText(html)).toBe("One two\nThree\nFour\nFive\na\nb");
  });

  test("collapses runs of blank lines", () => {
    expect(htmlToText("<p>A</p><p></p><p></p><p></p><p>B</p>")).toBe("A\n\nB");
  });

  test("decodes entities in a single pass", () => {
    expect(htmlToText("<p>Tom&nbsp;&amp;&nbsp;Jerry &lt;3 &#39;hi&#x27; &amp;lt;</p>")).toBe(
      "Tom & Jerry <3 'hi' &lt;",
    );
  });

  test("leaves unknown and out-of-range entities as written", () => {
    expect(htmlToText("&bogus; &#x110000;")).toBe("&bogus; &#x110000;");
  });
});
