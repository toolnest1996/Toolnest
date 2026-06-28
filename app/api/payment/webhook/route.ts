import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServiceSupabase } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.user_id;
    const plan = session.metadata?.plan === "enterprise" ? "ENTERPRISE" : "PRO";

    if (userId) {
      await supabase.from("profiles").update({ plan }).eq("id", userId);
      await supabase.from("subscriptions").upsert({
        user_id: userId,
        plan,
        status: "active",
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", sub.id)
      .single();

    if (existing?.user_id) {
      await supabase.from("profiles").update({ plan: "FREE" }).eq("id", existing.user_id);
      await supabase.from("subscriptions").update({ status: "cancelled" }).eq("user_id", existing.user_id);
    }
  }

  return NextResponse.json({ received: true });
}
