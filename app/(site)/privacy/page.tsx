import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "ToolNest privacy policy — how we handle your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-display text-4xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted">Last updated: June 2026</p>
      <div className="prose prose-invert mt-10 space-y-6 text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
          <p>We collect account information (name, email), usage data (tools used, files processed), and cookies for authentication and preferences.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">2. How We Use Data</h2>
          <p>Your data is used to provide services, improve tools, process payments, and send important account notifications. We do not sell your personal data.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">3. File Processing</h2>
          <p>Uploaded files are processed in your browser or on our servers and automatically deleted after 2 hours unless saved to your account history (Pro plan).</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">4. Third Parties</h2>
          <p>We use Supabase (auth/database), Stripe (payments), and Google (OAuth). Each has their own privacy policies.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-foreground">5. Contact</h2>
          <p>Questions? Email us at support@toolnest.io or use our contact form.</p>
        </section>
      </div>
    </div>
  );
}
