import prisma from "../lib/prisma";
import {
  computeNextSendAt,
  getZonedParts,
  isWithinSendWindow,
  nextSendWindowOpening,
  startOfZonedDay,
  type SendWindow,
} from "../lib/crm/sequences/schedule";
import {
  appendTrackingPixel,
  appendUnsubscribeFooter,
  buildUnsubscribeHeaders,
  createUnsubscribeToken,
  findUnresolvedVariables,
  renderTemplate,
  rewriteLinksForTracking,
  verifyUnsubscribeToken,
} from "../lib/crm/sequences/render";
import { checkSendEligibility } from "../lib/crm/sequences/suppression";

/**
 * Exercises the parts of the sequence engine that do not need Gmail
 * credentials: send-window arithmetic, template rendering, unsubscribe token
 * signing, suppression gating, and the tracking and unsubscribe endpoints.
 *
 * Usage: pnpm tsx --env-file=.env scripts/test-sequences.ts
 */

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

let failures = 0;

function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
  if (!ok) failures += 1;
}

const LONDON_WINDOW: SendWindow = {
  timezone: "Europe/London",
  sendWindowStart: 9,
  sendWindowEnd: 17,
  sendOnWeekends: false,
};

function testSchedule() {
  console.log("--- send windows ---");

  // 2026-08-10 is a Monday. 11:30 London == 10:30 UTC in BST.
  const mondayMidMorning = new Date("2026-08-10T10:30:00Z");
  check(
    "inside the window on a weekday",
    isWithinSendWindow(mondayMidMorning, LONDON_WINDOW),
    mondayMidMorning.toISOString()
  );

  const mondayNight = new Date("2026-08-10T22:00:00Z");
  check(
    "outside the window late at night",
    !isWithinSendWindow(mondayNight, LONDON_WINDOW),
    mondayNight.toISOString()
  );

  const saturday = new Date("2026-08-08T10:30:00Z");
  check(
    "weekends are closed when sendOnWeekends is false",
    !isWithinSendWindow(saturday, LONDON_WINDOW),
    saturday.toISOString()
  );
  check(
    "weekends are open when sendOnWeekends is true",
    isWithinSendWindow(saturday, { ...LONDON_WINDOW, sendOnWeekends: true }),
    saturday.toISOString()
  );

  // Before the window on the same day should move forward to 09:00 local
  const earlyMonday = new Date("2026-08-10T04:00:00Z");
  const openedEarly = nextSendWindowOpening(earlyMonday, LONDON_WINDOW);
  const openedEarlyParts = getZonedParts(openedEarly, "Europe/London");
  check(
    "an early send waits for the window to open the same day",
    openedEarlyParts.hour === 9 && openedEarlyParts.day === 10,
    `${openedEarly.toISOString()} -> ${openedEarlyParts.hour}:00 on the ${openedEarlyParts.day}th`
  );

  // After the window on Friday should land on Monday morning
  const fridayEvening = new Date("2026-08-07T20:00:00Z");
  const openedNextWeek = nextSendWindowOpening(fridayEvening, LONDON_WINDOW);
  const nextWeekParts = getZonedParts(openedNextWeek, "Europe/London");
  check(
    "a Friday-evening send waits until Monday",
    nextWeekParts.weekday === 1 && nextWeekParts.hour === 9,
    `${openedNextWeek.toISOString()} -> weekday ${nextWeekParts.weekday} at ${nextWeekParts.hour}:00`
  );

  // A 3-day delay from Monday should land on Thursday, clamped into the window
  const nextSend = computeNextSendAt(
    mondayMidMorning,
    { delayDays: 3, delayHours: 0 },
    LONDON_WINDOW
  );
  const nextSendParts = getZonedParts(nextSend, "Europe/London");
  check(
    "a 3-day delay lands inside the window",
    isWithinSendWindow(nextSend, LONDON_WINDOW) && nextSendParts.day === 13,
    `${nextSend.toISOString()} -> day ${nextSendParts.day} at ${nextSendParts.hour}:00`
  );

  // A delay that lands on Saturday must be pushed to Monday
  const intoWeekend = computeNextSendAt(
    new Date("2026-08-07T10:30:00Z"),
    { delayDays: 1, delayHours: 0 },
    LONDON_WINDOW
  );
  const weekendParts = getZonedParts(intoWeekend, "Europe/London");
  check(
    "a delay landing on a weekend is pushed to Monday",
    weekendParts.weekday === 1,
    `${intoWeekend.toISOString()} -> weekday ${weekendParts.weekday}`
  );

  const dayStart = startOfZonedDay(mondayMidMorning, "Europe/London");
  const dayStartParts = getZonedParts(dayStart, "Europe/London");
  check(
    "startOfZonedDay returns local midnight",
    dayStartParts.hour === 0 && dayStartParts.day === 10,
    `${dayStart.toISOString()} -> ${dayStartParts.hour}:00 on the ${dayStartParts.day}th`
  );

  // A zone well away from UTC proves the offset maths, not just BST
  const tokyoWindow: SendWindow = { ...LONDON_WINDOW, timezone: "Asia/Tokyo" };
  const tokyoMorning = new Date("2026-08-10T01:00:00Z"); // 10:00 JST
  check(
    "window respects a non-UTC timezone",
    isWithinSendWindow(tokyoMorning, tokyoWindow) &&
      !isWithinSendWindow(tokyoMorning, LONDON_WINDOW),
    "10:00 JST is open, 02:00 London is not"
  );
}

function testRendering() {
  console.log("\n--- template rendering ---");

  const context = {
    firstName: "Priya",
    lastName: "Shah",
    companyName: "Acme Robotics",
    email: "priya@acme.test",
    senderName: "Jaro Bakker",
    senderFirstName: "Jaro",
    jobTitle: null,
  };

  const rendered = renderTemplate(
    "Hi {{firstName}}, saw {{companyName}} is hiring. {{jobTitle|Your team}} might need this. — {{senderFirstName}}",
    context
  );
  check(
    "fills variables and applies fallbacks",
    rendered ===
      "Hi Priya, saw Acme Robotics is hiring. Your team might need this. — Jaro",
    rendered
  );

  const missing = findUnresolvedVariables(
    "Hi {{firstName}}, about {{unknownThing}} and {{jobTitle}}",
    context
  );
  check(
    "reports unresolved variables",
    missing.includes("unknownThing") && missing.includes("jobTitle"),
    missing.join(", ")
  );

  const token = createUnsubscribeToken("Priya@Acme.test");
  check(
    "unsubscribe token round-trips and normalises case",
    verifyUnsubscribeToken(token) === "priya@acme.test",
    `${token} -> ${verifyUnsubscribeToken(token)}`
  );
  check(
    "a tampered unsubscribe token is rejected",
    verifyUnsubscribeToken(`${token}x`) === null,
    "rejected"
  );

  const footer = appendUnsubscribeFooter(
    "<p>Hello</p>",
    "priya@acme.test",
    "Jaro Bakker"
  );
  check(
    "footer carries an unsubscribe link",
    footer.includes("/api/unsubscribe/") && footer.includes("Unsubscribe"),
    "present"
  );

  const headers = buildUnsubscribeHeaders("priya@acme.test");
  check(
    "List-Unsubscribe headers are built",
    headers["List-Unsubscribe"].includes("/api/unsubscribe/") &&
      headers["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click",
    headers["List-Unsubscribe"]
  );

  const withPixel = appendTrackingPixel("<p>Hi</p>", "msg_123");
  check(
    "tracking pixel points at the open endpoint",
    withPixel.includes("/api/track/open/msg_123"),
    "present"
  );

  const rewritten = rewriteLinksForTracking(
    "<a href=\"https://jaro.dev/book\">Book</a> <a href=\"http://localhost:3000/api/unsubscribe/abc\">Unsub</a>",
    "msg_123"
  );
  check(
    "click tracking rewrites content links only",
    rewritten.includes("/api/track/click/msg_123?url=") &&
      rewritten.includes("href=\"http://localhost:3000/api/unsubscribe/abc\""),
    "content link rewritten, unsubscribe left alone"
  );
}

async function testSuppression() {
  console.log("\n--- suppression gate ---");

  const internal = await checkSendEligibility("jaro@jaro.dev");
  check(
    "refuses to mail our own domain",
    !internal.canSend,
    internal.reason ?? ""
  );

  const invalid = await checkSendEligibility("not-an-email");
  check("refuses an invalid address", !invalid.canSend, invalid.reason ?? "");

  const email = `seq-test-${Date.now()}@example.test`;

  const before = await checkSendEligibility(email);
  check("allows an unknown address", before.canSend, "eligible");

  await prisma.suppression.create({
    data: { email, reason: "unsubscribed" },
  });

  try {
    const after = await checkSendEligibility(email);
    check(
      "blocks a suppressed address",
      !after.canSend && Boolean(after.reason?.includes("unsubscribed")),
      after.reason ?? ""
    );
  } finally {
    await prisma.suppression.deleteMany({ where: { email } });
  }

  const person = await prisma.person.create({
    data: {
      email: `dnc-test-${Date.now()}@example.test`,
      firstName: "Do",
      lastName: "NotContact",
      doNotContact: true,
    },
    select: { id: true, email: true },
  });

  try {
    const dnc = await checkSendEligibility(person.email as string);
    check(
      "blocks a do-not-contact contact",
      !dnc.canSend && Boolean(dnc.reason?.includes("do not contact")),
      dnc.reason ?? ""
    );
  } finally {
    await prisma.person.delete({ where: { id: person.id } });
  }
}

async function testEndpoints() {
  console.log(`\n--- endpoints (${BASE_URL}) ---`);

  const email = `endpoint-test-${Date.now()}@example.test`;

  const person = await prisma.person.create({
    data: { email, firstName: "Endpoint", lastName: "Test" },
    select: { id: true },
  });

  const sequence = await prisma.sequence.create({
    data: {
      name: `Endpoint test ${Date.now()}`,
      status: "ACTIVE",
      senderEmail: "hello@jaro.dev",
      senderName: "Jaro.dev",
      trackOpens: true,
      trackClicks: true,
      steps: {
        create: {
          order: 1,
          delayDays: 0,
          delayHours: 0,
          subject: "Hi {{firstName}}",
          bodyHtml: "<p>Hello {{firstName}}</p>",
        },
      },
    },
    include: { steps: true },
  });

  const enrollment = await prisma.sequenceEnrollment.create({
    data: {
      sequenceId: sequence.id,
      personId: person.id,
      senderEmail: sequence.senderEmail,
      nextSendAt: new Date(),
    },
    select: { id: true },
  });

  const message = await prisma.sequenceMessage.create({
    data: {
      enrollmentId: enrollment.id,
      stepId: sequence.steps[0].id,
      toEmail: email,
      subject: "Hi Endpoint",
      body: "<p>Hello Endpoint</p>",
      sentAt: new Date(),
    },
    select: { id: true },
  });

  try {
    const open = await fetch(`${BASE_URL}/api/track/open/${message.id}`);
    check(
      "open pixel returns a GIF",
      open.status === 200 &&
        (open.headers.get("content-type") ?? "").includes("image/gif"),
      `HTTP ${open.status} ${open.headers.get("content-type")}`
    );

    const afterOpen = await prisma.sequenceMessage.findUnique({
      where: { id: message.id },
      select: { openedAt: true, openCount: true },
    });
    check(
      "open is recorded",
      afterOpen?.openedAt !== null && afterOpen?.openCount === 1,
      `openedAt=${afterOpen?.openedAt?.toISOString()} count=${afterOpen?.openCount}`
    );

    const unknownOpen = await fetch(
      `${BASE_URL}/api/track/open/does-not-exist`
    );
    check(
      "unknown message still returns a pixel",
      unknownOpen.status === 200,
      `HTTP ${unknownOpen.status}`
    );

    const click = await fetch(
      `${BASE_URL}/api/track/click/${message.id}?url=${encodeURIComponent("https://jaro.dev/book")}`,
      { redirect: "manual" }
    );
    check(
      "click redirects to the original link",
      click.status === 302 &&
        click.headers.get("location") === "https://jaro.dev/book",
      `HTTP ${click.status} -> ${click.headers.get("location")}`
    );

    const badScheme = await fetch(
      `${BASE_URL}/api/track/click/${message.id}?url=${encodeURIComponent("javascript:alert(1)")}`,
      { redirect: "manual" }
    );
    check(
      "click refuses a non-http scheme",
      badScheme.status === 302 &&
        !(badScheme.headers.get("location") ?? "").startsWith("javascript:"),
      `-> ${badScheme.headers.get("location")}`
    );

    const afterClick = await prisma.sequenceMessage.findUnique({
      where: { id: message.id },
      select: { clickedAt: true, clickCount: true },
    });
    check(
      "click is recorded",
      afterClick?.clickedAt !== null && (afterClick?.clickCount ?? 0) >= 1,
      `clickedAt=${afterClick?.clickedAt?.toISOString()} count=${afterClick?.clickCount}`
    );

    const badToken = await fetch(`${BASE_URL}/api/unsubscribe/not-a-token`);
    check(
      "unsubscribe rejects an invalid token",
      badToken.status === 400,
      `HTTP ${badToken.status}`
    );

    const token = createUnsubscribeToken(email);
    const unsub = await fetch(`${BASE_URL}/api/unsubscribe/${token}`);
    check(
      "unsubscribe accepts a signed token",
      unsub.status === 200,
      `HTTP ${unsub.status}`
    );

    const suppression = await prisma.suppression.findUnique({
      where: { email },
      select: { reason: true },
    });
    check(
      "unsubscribe writes a suppression",
      suppression?.reason === "unsubscribed",
      `${suppression?.reason}`
    );

    const stoppedEnrollment = await prisma.sequenceEnrollment.findUnique({
      where: { id: enrollment.id },
      select: { status: true, nextSendAt: true },
    });
    check(
      "unsubscribe stops the enrollment",
      stoppedEnrollment?.status === "UNSUBSCRIBED" &&
        stoppedEnrollment?.nextSendAt === null,
      `status=${stoppedEnrollment?.status} nextSendAt=${stoppedEnrollment?.nextSendAt}`
    );

    const dncPerson = await prisma.person.findUnique({
      where: { id: person.id },
      select: { doNotContact: true },
    });
    check(
      "unsubscribe marks the contact do-not-contact",
      dncPerson?.doNotContact === true,
      `doNotContact=${dncPerson?.doNotContact}`
    );

    // One-click unsubscribe from Gmail arrives as a POST
    const postUnsub = await fetch(`${BASE_URL}/api/unsubscribe/${token}`, {
      method: "POST",
    });
    check(
      "one-click POST unsubscribe works",
      postUnsub.status === 200,
      `HTTP ${postUnsub.status}`
    );
  } finally {
    await prisma.suppression.deleteMany({ where: { email } });
    await prisma.sequence.delete({ where: { id: sequence.id } });
    await prisma.person.delete({ where: { id: person.id } });
    console.log("cleaned up the test sequence, contact and suppression");
  }
}

async function main() {
  testSchedule();
  testRendering();
  await testSuppression();
  await testEndpoints();

  console.log(
    failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("TEST FAILED:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
