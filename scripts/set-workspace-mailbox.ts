/**
 * Points a Studio user at their @jaro.dev Workspace mailbox and makes sure the
 * recorder watches that calendar. Run this when someone gets a Workspace
 * account, since sequences send from the mailbox and the calendar sync can only
 * impersonate addresses inside the domain.
 *
 * Usage:
 *   pnpm crm:set-mailbox <login-email> <mailbox@jaro.dev> [--no-rule]
 */
import prisma from "../lib/prisma";

const LOG = "[Workspace Mailbox]";

async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const skipRule = process.argv.includes("--no-rule");
  const [loginEmail, mailbox] = args;

  if (!loginEmail || !mailbox) {
    throw new Error(
      "Usage: pnpm crm:set-mailbox <login-email> <mailbox@jaro.dev> [--no-rule]"
    );
  }

  const domain = process.env.GOOGLE_WORKSPACE_DOMAIN || "jaro.dev";
  if (!mailbox.toLowerCase().endsWith(`@${domain.toLowerCase()}`)) {
    throw new Error(
      `${mailbox} is outside @${domain}; domain-wide delegation cannot impersonate it`
    );
  }

  const user = await prisma.user.findUnique({
    where: { email: loginEmail.toLowerCase().trim() },
    select: { id: true, email: true, firstName: true, lastName: true },
  });

  if (!user) throw new Error(`No user found for ${loginEmail}`);

  const normalisedMailbox = mailbox.toLowerCase().trim();

  await prisma.user.update({
    where: { id: user.id },
    data: { sendingMailbox: normalisedMailbox },
  });

  console.log(
    `${LOG} ${user.firstName ?? user.email} now sends from ${normalisedMailbox}`
  );

  if (skipRule) return;

  const existingRule = await prisma.recordingRule.findUnique({
    where: { calendarEmail: normalisedMailbox },
    select: { id: true, enabled: true, userId: true },
  });

  if (existingRule) {
    await prisma.recordingRule.update({
      where: { id: existingRule.id },
      data: { userId: user.id, enabled: true },
    });
    console.log(`${LOG} recording rule for ${normalisedMailbox} is enabled`);
    return;
  }

  const rule = await prisma.recordingRule.create({
    data: { calendarEmail: normalisedMailbox, userId: user.id },
    select: { id: true, botName: true, joinMinutesBefore: true, minAttendees: true },
  });

  console.log(
    `${LOG} created recording rule ${rule.id}: "${rule.botName}" joins ${rule.joinMinutesBefore} min before, external attendee required, min ${rule.minAttendees} attendees`
  );
}

main()
  .catch((error) => {
    console.error(`${LOG} ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(process.exitCode ?? 0);
  });
