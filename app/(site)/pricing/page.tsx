import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { CheckoutButton } from "@/components/pricing/checkout-button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for ToolNest. Free, Pro and Enterprise plans.",
};

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    highlight: false,
    plan: null as null,
    features: ["5 tools per day", "Max 50 MB file size", "Standard processing", "Ad supported"],
    cta: "Get started",
    href: "/register",
  },
  {
    name: "Pro",
    price: "$9.99",
    period: "per month",
    highlight: true,
    plan: "pro" as const,
    features: ["Unlimited tools", "Max 500 MB file size", "30-day history", "No ads", "Priority processing"],
    cta: "Upgrade to Pro",
    href: null,
  },
  {
    name: "Enterprise",
    price: "$29.99",
    period: "per month",
    highlight: false,
    plan: "enterprise" as const,
    features: ["Everything in Pro", "Max 2 GB file size", "Full API access", "Team accounts (5 users)", "Dedicated support"],
    cta: "Upgrade to Enterprise",
    href: null,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold">
          Simple, <span className="text-gradient">transparent</span> pricing
        </h1>
        <p className="mt-3 text-muted">Start free. Upgrade when you need more power. Cancel anytime.</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan.name} className={`relative flex flex-col rounded-2xl border p-6 ${plan.highlight ? "border-primary bg-card shadow-xl shadow-primary/10" : "border-border bg-card"}`}>
            {plan.highlight && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full gradient-primary px-3 py-1 text-xs font-semibold text-white">Most popular</span>
            )}
            <h2 className="font-display text-xl font-bold">{plan.name}</h2>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="font-display text-4xl font-extrabold">{plan.price}</span>
              <span className="text-sm text-muted">/ {plan.period}</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-success" />{f}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {plan.plan ? (
                <CheckoutButton plan={plan.plan} label={plan.cta} variant={plan.highlight ? "gradient" : "outline"} />
              ) : (
                <Link href={plan.href!} className={`inline-flex h-11 w-full items-center justify-center rounded-xl font-medium transition-all ${plan.highlight ? "gradient-primary text-white hover:opacity-90" : "border border-border hover:bg-card-hover"}`}>
                  {plan.cta}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
