import prisma from "../lib/prisma";

/**
 * Gives deals that predate the pricing structure a starting point.
 *
 * Before pricing items existed a deal carried one flat `value`, which is
 * indistinguishable from a single fixed project fee, so this turns each of
 * those values into one PROJECT item. The deal's value is left untouched
 * because the item sums back to exactly the same number.
 *
 * Safe to re-run: deals that already have pricing items, or whose value is
 * zero, are skipped.
 *
 * Usage:
 *   pnpm crm:backfill-deal-pricing           (dry run)
 *   pnpm crm:backfill-deal-pricing --apply
 */

const LOG = "[Backfill Deal Pricing]";

const isApply = process.argv.includes("--apply");

async function main() {
  console.log(`${LOG} ${isApply ? "APPLY" : "DRY RUN"} mode`);
  console.log(`${LOG} finding deals with a value but no pricing items...`);

  const deals = await prisma.deal.findMany({
    where: { value: { gt: 0 }, pricingItems: { none: {} } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, value: true, currency: true },
  });

  console.log(`${LOG} ${deals.length} deals to convert`);

  let created = 0;

  for (const deal of deals) {
    console.log(
      `  "${deal.name}": ${deal.currency} ${deal.value.toLocaleString()} -> one project item`
    );

    if (!isApply) {
      created += 1;
      continue;
    }

    await prisma.dealPricingItem.create({
      data: {
        dealId: deal.id,
        type: "PROJECT",
        label: "Project fee",
        unitAmount: deal.value,
        quantity: 1,
        order: 0,
      },
    });
    created += 1;
  }

  console.log(
    `${LOG} ${isApply ? "created" : "would create"} ${created} pricing items`
  );

  if (!isApply) {
    console.log(`\n${LOG} re-run with --apply to write these changes`);
  }
}

main()
  .catch((error) => {
    console.error(`${LOG} failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
