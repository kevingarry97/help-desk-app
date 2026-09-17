import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    from: { type: "string", default: "Jane Doe <jane@example.com>" },
    subject: { type: "string", default: "I can't sign in" },
    text: { type: "string", default: "Every time I try, the page says my session expired." },
    html: { type: "string" },
    "message-id": { type: "string" },
    url: {
      type: "string",
      default: `http://localhost:${process.env.PORT ?? 4000}/api/webhooks/inbound-email`,
    },
  },
});

const secret = process.env.INBOUND_EMAIL_SECRET;

if (!secret) {
  console.warn("INBOUND_EMAIL_SECRET is not set; the request will go without a token.");
}

const response = await fetch(values.url, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(secret ? { authorization: `Bearer ${secret}` } : {}),
  },
  body: JSON.stringify({
    from: values.from,
    subject: values.subject,
    text: values.text,
    html: values.html,
    messageId: values["message-id"],
  }),
});

console.log(response.status, await response.text());
process.exitCode = response.ok ? 0 : 1;
