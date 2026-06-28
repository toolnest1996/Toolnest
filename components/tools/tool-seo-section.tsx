import Link from "next/link";
import { getTool } from "@/lib/data/tools";
import { getToolSeoConfig } from "@/lib/seo/tool-seo-data";

export function ToolSeoSection({ slug }: { slug: string }) {
  const seo = getToolSeoConfig(slug);
  if (!seo) return null;

  const tool = getTool(slug);
  const toolName = tool?.name ?? "this tool";
  const whyHeading = seo.whyHeading ?? `Why use ${toolName} with ToolNest?`;
  const howToHeading = seo.howToHeading ?? `How to use ${toolName} online`;

  const related = seo.relatedSlugs
    .map((s) => getTool(s))
    .filter((t): t is NonNullable<typeof t> => !!t);

  return (
    <article className="mt-12 border-t border-border pt-10" aria-labelledby="tool-seo-heading">
      <header className="max-w-3xl">
        <h2 id="tool-seo-heading" className="font-display text-2xl font-bold sm:text-3xl">
          {whyHeading}
        </h2>
        {seo.tagline && <p className="mt-2 text-lg text-muted">{seo.tagline}</p>}
        <p className="mt-4 leading-relaxed text-muted">{seo.intro}</p>
      </header>

      <section className="mt-10" aria-labelledby="features-heading">
        <h3 id="features-heading" className="font-display text-xl font-semibold">
          Key features
        </h3>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {seo.features.map((f) => (
            <li key={f.title} className="rounded-xl border border-border bg-card p-4">
              <h4 className="font-medium text-foreground">{f.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-muted">{f.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="howto-heading">
        <h3 id="howto-heading" className="font-display text-xl font-semibold">
          {howToHeading}
        </h3>
        <ol className="mt-4 space-y-4">
          {seo.steps.map((step, i) => (
            <li key={step.name} id={`step-${i + 1}`} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                {i + 1}
              </span>
              <div>
                <h4 className="font-medium">{step.name}</h4>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="faq-heading">
        <h3 id="faq-heading" className="font-display text-xl font-semibold">
          Frequently asked questions
        </h3>
        <dl className="mt-4 space-y-4">
          {seo.faqs.map((faq) => (
            <div key={faq.question} className="rounded-xl border border-border bg-card p-4">
              <dt className="font-medium text-foreground">{faq.question}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-muted">{faq.answer}</dd>
            </div>
          ))}
        </dl>
      </section>

      {related.length > 0 && (
        <section className="mt-10" aria-labelledby="related-heading">
          <h3 id="related-heading" className="font-display text-xl font-semibold">
            Related PDF tools
          </h3>
          <ul className="mt-4 flex flex-wrap gap-2">
            {related.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/tool/${t.slug}`}
                  className="inline-flex rounded-full border border-border bg-card px-4 py-2 text-sm transition-colors hover:border-primary hover:text-primary"
                >
                  {t.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
