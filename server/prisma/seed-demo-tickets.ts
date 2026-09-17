import { prisma } from "../src/db";
import { TicketCategory, TicketStatus } from "../generated/prisma/enums";

/**
 * Fills the dev database with realistic tickets across every status and category, spread over
 * the last five weeks. Development only. Re-runnable: rows are keyed by a demo Message-ID, so a
 * second run updates them instead of duplicating. Remove with `bun prisma/seed-demo-tickets.ts --clear`.
 */

const DEMO_DOMAIN = "@demo.helpdesk.local";
const HOUR = 60 * 60 * 1000;

const { OPEN, RESOLVED, CLOSED } = TicketStatus;
const { GENERAL_QUESTION: GENERAL, TECHNICAL_QUESTION: TECHNICAL, REFUND_REQUEST: REFUND } =
  TicketCategory;

type DemoTicket = {
  subject: string;
  from: string;
  category: TicketCategory;
  status: TicketStatus;
  hoursAgo: number;
  body: string;
};

const DEMO_TICKETS: DemoTicket[] = [
  {
    subject: "Charged twice for Data Science Foundations",
    from: "marcus.lee@example.com",
    category: REFUND,
    status: OPEN,
    hoursAgo: 1,
    body: "Hi,\n\nMy card was charged twice for Data Science Foundations this morning.\n\n  Order #48213 — $149.00\n  Order #48214 — $149.00\n\nCould you refund the duplicate? I only enrolled once.\n\nThanks,\nMarcus",
  },
  {
    subject: "Video lessons stop playing after two minutes on Safari",
    from: "lee.wong@example.com",
    category: TECHNICAL,
    status: OPEN,
    hoursAgo: 3,
    body: "Every lesson in Module 3 freezes at around 2:00 in Safari 18 on my MacBook. Chrome works fine. I've cleared the cache and turned off extensions.\n\nIs this a known issue?",
  },
  {
    subject: "Can I transfer my seat to a colleague?",
    from: "ana.costa@example.org",
    category: GENERAL,
    status: OPEN,
    hoursAgo: 5,
    body: "I bought a seat on Project Management Essentials but I'm moving teams. Could my colleague Rui (rui.pereira@example.org) take my place instead?",
  },
  {
    subject: "Password reset email never arrives",
    from: "jordan.blake@example.net",
    category: TECHNICAL,
    status: OPEN,
    hoursAgo: 8,
    body: "I've requested a password reset four times since yesterday. Nothing in my inbox or spam folder. My address is jordan.blake@example.net.",
  },
  {
    subject: "Refund for the spring course",
    from: "sam.rivera@example.com",
    category: REFUND,
    status: OPEN,
    hoursAgo: 11,
    body: "Hi there,\n\nI signed up for the Spring Web Development cohort but a family emergency means I can't take part. I haven't started any lessons.\n\nCould I get a refund?\n\nThanks,\nSam",
  },
  {
    subject: "When does enrolment for the autumn term close?",
    from: "kim.nguyen@example.com",
    category: GENERAL,
    status: OPEN,
    hoursAgo: 14,
    body: "I'd like to join the autumn intake of UX Research Methods. What's the last day I can enrol?",
  },
  {
    subject: "Quiz 4 marked my correct answers as wrong",
    from: "fatima.zahra@example.edu",
    category: TECHNICAL,
    status: OPEN,
    hoursAgo: 20,
    body: "Questions 3 and 7 on Quiz 4 (Statistics for Analysts) show my answer as incorrect, but it matches the worked solution in the lesson exactly. Screenshot attached.",
  },
  {
    subject: "Invoice needs our company VAT number",
    from: "accounts@northwind.example.com",
    category: GENERAL,
    status: OPEN,
    hoursAgo: 26,
    body: "Please reissue invoice INV-20931 with our VAT number GB 123 4567 89 and the company name Northwind Traders Ltd. Our finance team can't process it otherwise.",
  },
  {
    subject: "App crashes when downloading lessons for offline use",
    from: "diego.martinez@example.com",
    category: TECHNICAL,
    status: OPEN,
    hoursAgo: 31,
    body: "Android app 4.2.1 on a Pixel 7. Tapping \"Download module\" closes the app straight away. Streaming works.",
  },
  {
    subject: "refund please — course wasn't what was described",
    from: "olivia.brown@example.com",
    category: REFUND,
    status: OPEN,
    hoursAgo: 40,
    body: "The listing said the course covered React 19 but the videos use class components and an old version. I've watched two lessons. I'd like my money back.",
  },
  {
    subject: "Do you offer discounts for students?",
    from: "noah.schmidt@example.edu",
    category: GENERAL,
    status: OPEN,
    hoursAgo: 52,
    body: "I'm a full-time university student. Is there an education discount on the annual plan?",
  },
  {
    subject: "Captions are out of sync in Lesson 12",
    from: "grace.okafor@example.com",
    category: TECHNICAL,
    status: OPEN,
    hoursAgo: 60,
    body: "In Intro to Cloud Architecture, Lesson 12, the captions run about four seconds behind the audio from the halfway point. I rely on captions, so this makes the lesson hard to follow.",
  },
  {
    subject: "Certificate PDF is blank when downloaded",
    from: "priya.shah@example.edu",
    category: TECHNICAL,
    status: RESOLVED,
    hoursAgo: 70,
    body: "I finished the course yesterday. The certificate downloads, but it opens as an empty white page in every PDF viewer I've tried.",
  },
  {
    subject: "Charged after cancelling my subscription",
    from: "ethan.clarke@example.com",
    category: REFUND,
    status: RESOLVED,
    hoursAgo: 80,
    body: "I cancelled on 1 September and got a confirmation email, but I was still charged $29 on the 5th. Could you refund that payment?",
  },
  {
    subject: "How do I change the email on my account?",
    from: "hannah.kim@example.com",
    category: GENERAL,
    status: RESOLVED,
    hoursAgo: 96,
    body: "I'm leaving my job and will lose access to hannah.kim@example.com. How can I move my account and certificates to a personal address?",
  },
  {
    subject: "Course access expired early",
    from: "liam.oconnor@example.ie",
    category: TECHNICAL,
    status: RESOLVED,
    hoursAgo: 110,
    body: "My access to Advanced Excel was meant to last 12 months from March, but it says expired as of today.",
  },
  {
    subject: "Bulk licences for a team of 25",
    from: "procurement@contoso.example.com",
    category: GENERAL,
    status: RESOLVED,
    hoursAgo: 130,
    body: "We're looking at licences for 25 analysts across two sites. Do you offer volume pricing, and can we manage seats centrally?",
  },
  {
    subject: "Refund for duplicate annual plan purchase",
    from: "yuki.tanaka@example.jp",
    category: REFUND,
    status: RESOLVED,
    hoursAgo: 150,
    body: "I accidentally bought the annual plan twice — once on the website and once in the iOS app. Please refund one of them.",
  },
  {
    subject: "Discount code SPRING25 not accepted at checkout",
    from: "chloe.martin@example.fr",
    category: TECHNICAL,
    status: RESOLVED,
    hoursAgo: 170,
    body: "The code from your newsletter says \"invalid or expired\", but the email says it's valid until the end of the month.",
  },
  {
    subject: "Can I pause my subscription over summer?",
    from: "ben.adeyemi@example.com",
    category: GENERAL,
    status: RESOLVED,
    hoursAgo: 200,
    body: "I won't be studying in July and August. Is there a way to pause rather than cancel so I keep my progress?",
  },
  {
    subject: "Two-factor codes rejected after changing phones",
    from: "maria.rossi@example.it",
    category: TECHNICAL,
    status: RESOLVED,
    hoursAgo: 230,
    body: "I moved my authenticator app to a new phone and now every code is rejected. I still have my backup codes printed somewhere but can't find them.",
  },
  {
    subject: "Refund request: enrolled in the wrong level",
    from: "arjun.patel@example.in",
    category: REFUND,
    status: RESOLVED,
    hoursAgo: 260,
    body: "I meant to buy Python for Beginners but bought Python for Data Engineers. Could you refund it or switch me to the beginner course?",
  },
  {
    subject: "Where can I find my transcript?",
    from: "isabel.garcia@example.es",
    category: GENERAL,
    status: CLOSED,
    hoursAgo: 300,
    body: "My employer wants a transcript showing the modules I completed and the dates. Is that available somewhere in my account?",
  },
  {
    subject: "Please delete my account and personal data",
    from: "tom.hughes@example.co.uk",
    category: GENERAL,
    status: CLOSED,
    hoursAgo: 340,
    body: "Under GDPR I'd like my account and all personal data deleted. Please confirm once done.",
  },
  {
    subject: "Refund for a course I never started",
    from: "zoe.anderson@example.com",
    category: REFUND,
    status: CLOSED,
    hoursAgo: 380,
    body: "Bought Digital Marketing 101 two months ago and never opened it. Is a refund still possible?",
  },
  {
    subject: "Lesson downloads fail on the company network",
    from: "it.support@fabrikam.example.com",
    category: TECHNICAL,
    status: CLOSED,
    hoursAgo: 420,
    body: "Several of our staff can't download lesson files on the office network. Which domains and ports do we need to allow through the proxy?",
  },
  {
    subject: "Is there a certificate for the free course?",
    from: "lucas.silva@example.com.br",
    category: GENERAL,
    status: CLOSED,
    hoursAgo: 480,
    body: "I completed Intro to SQL (free). Do free courses come with a certificate, or only paid ones?",
  },
  {
    subject: "Payment failed but money left my account",
    from: "amelia.jones@example.com.au",
    category: REFUND,
    status: CLOSED,
    hoursAgo: 540,
    body: "Checkout showed \"payment failed\", so I didn't get access, but my bank shows the $89 as taken. Please either refund it or give me the course.",
  },
  {
    subject: "Screen reader skips the quiz answer options",
    from: "daniel.lee@example.com",
    category: TECHNICAL,
    status: CLOSED,
    hoursAgo: 620,
    body: "Using NVDA with Firefox, the answer options on multiple-choice quizzes aren't announced — I hear the question and then \"submit\".",
  },
  {
    subject: "Can my certificate show my full legal name?",
    from: "nadia.haddad@example.com",
    category: GENERAL,
    status: CLOSED,
    hoursAgo: 700,
    body: "My certificate uses my display name \"Nadz\". I need it to say Nadia Haddad for a job application.",
  },
  {
    subject: "Refund for accidental renewal",
    from: "oscar.nilsson@example.se",
    category: REFUND,
    status: CLOSED,
    hoursAgo: 780,
    body: "My plan auto-renewed yesterday — I thought I'd turned renewal off. I haven't used it since. Could you reverse the charge?",
  },
  {
    subject: "Login loop after signing in with Google",
    from: "emily.watson@example.com",
    category: TECHNICAL,
    status: CLOSED,
    hoursAgo: 840,
    body: "After choosing my Google account I land back on the sign-in page, over and over. Happens in Chrome and Edge.",
  },
];

if (process.env.NODE_ENV === "production") {
  throw new Error("seed-demo-tickets.ts is a development convenience — refusing to run in production.");
}

const messageIdFor = (index: number) => `demo-ticket-${index + 1}${DEMO_DOMAIN}`;

if (process.argv.includes("--clear")) {
  const { count } = await prisma.ticket.deleteMany({
    where: { messageId: { endsWith: DEMO_DOMAIN } },
  });

  console.log(`Removed ${count} demo ticket(s)`);
} else {
  const now = Date.now();

  for (const [index, ticket] of DEMO_TICKETS.entries()) {
    const createdAt = new Date(now - ticket.hoursAgo * HOUR);
    const updatedAt =
      ticket.status === OPEN ? createdAt : new Date(createdAt.getTime() + (2 + (index % 5) * 6) * HOUR);
    const data = {
      subject: ticket.subject,
      body: ticket.body,
      requesterEmail: ticket.from,
      category: ticket.category,
      status: ticket.status,
      createdAt,
      updatedAt,
    };

    await prisma.ticket.upsert({
      where: { messageId: messageIdFor(index) },
      update: data,
      create: { ...data, messageId: messageIdFor(index) },
    });
  }

  const counts = Object.fromEntries(
    [OPEN, RESOLVED, CLOSED].map((status) => [
      status,
      DEMO_TICKETS.filter((ticket) => ticket.status === status).length,
    ]),
  );

  console.log(
    `Seeded ${DEMO_TICKETS.length} demo tickets — ${counts.OPEN} open, ${counts.RESOLVED} resolved, ${counts.CLOSED} closed`,
  );
}

await prisma.$disconnect();
