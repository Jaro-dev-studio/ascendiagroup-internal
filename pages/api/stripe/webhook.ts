import { NextApiRequest, NextApiResponse } from "next";
import { buffer } from "micro";
import Stripe from "stripe";
import prisma from "@/lib/prisma";
import { reportOpsFailure } from "@/lib/ops-alerts";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const config = {
  api: {
    bodyParser: false,
  },
};

const SOURCE = "Webhook: stripe";

/**
 * Records a paid deposit against its quote.
 *
 * The customer has already been charged by the time Stripe calls, so a failure
 * here means money taken with nothing to show for it in the studio: it is
 * reported rather than only logged.
 */
async function markQuotePaid(
  session: Stripe.Checkout.Session,
  eventType: string
): Promise<void> {
  const quoteToken = session.metadata?.quoteToken;
  const depositAmount = session.metadata?.depositAmount;

  if (!quoteToken) {
    await reportOpsFailure({
      source: SOURCE,
      summary: `${eventType} arrived without a quoteToken; the payment cannot be matched to a quote`,
      context: { sessionId: session.id, paymentIntent: String(session.payment_intent) },
    });
    return;
  }

  try {
    console.log(`[Stripe] recording deposit for quote ${quoteToken}...`);

    await prisma.sharedQuote.update({
      where: { token: quoteToken },
      data: {
        stripePaymentId: session.payment_intent as string,
        depositPaidAt: new Date(),
        depositPaidAmount: depositAmount ? parseInt(depositAmount) : null,
      },
    });

    console.log(`[Stripe] quote ${quoteToken} marked as paid`);
  } catch (error) {
    await reportOpsFailure({
      source: SOURCE,
      summary: "A deposit was paid but the quote could not be marked as paid",
      error,
      context: {
        quoteToken,
        sessionId: session.id,
        paymentIntent: String(session.payment_intent),
        amount: depositAmount ?? "unknown",
      },
    });
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).end("Method Not Allowed");
  }

  const buf = await buffer(req);
  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header" });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err) {
    await reportOpsFailure({
      source: SOURCE,
      summary: "Stripe webhook signature verification failed",
      error: err,
      dedupeKey: "signature verification failed",
    });
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed": {
      await markQuotePaid(event.data.object as Stripe.Checkout.Session, event.type);
      break;
    }

    case "checkout.session.async_payment_succeeded": {
      // For bank transfers, payment may be async
      await markQuotePaid(event.data.object as Stripe.Checkout.Session, event.type);
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await reportOpsFailure({
        source: SOURCE,
        summary: "A deposit payment failed",
        context: {
          sessionId: session.id,
          quoteToken: session.metadata?.quoteToken ?? "unknown",
          customerEmail: session.customer_details?.email ?? "unknown",
        },
        dedupeKey: "async payment failed",
      });
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.status(200).json({ received: true });
}
