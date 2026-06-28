import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "ToolNest terms of service.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted">Last updated: June 2026</p>
      <div className="prose prose-invert mt-10 space-y-6 text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Acceptance</h2>
          <p>By using ToolNest.io you agree to these terms. If you disagree, please do not use our services.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. Service Description</h2>
          <p>ToolNest provides online tools for file conversion, editing, and processing. Services are provided &quot;as is&quot; without warranty.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. Acceptable Use</h2>
          <p>You may not use ToolNest for illegal activities, copyright infringement, malware distribution, or abuse of our systems.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Subscriptions</h2>
          <p>Pro and Enterprise plans are billed monthly via Stripe. Cancel anytime; access continues until the billing period ends.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Limitation of Liability</h2>
          <p>ToolNest is not liable for data loss, service interruptions, or damages arising from use of our tools.</p>
        </section>
      </div>
    </div>
  );
}
