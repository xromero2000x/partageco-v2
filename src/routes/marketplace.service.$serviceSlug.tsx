import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { listMarketplaceOffers } from "@/lib/offers.functions";
import { OfferCard, type MarketplaceOfferLike } from "@/components/marketplace/OfferCard";
import { MVP_NOTICE, NON_AFFILIATION_NOTICE } from "@/components/marketplace/serviceVisuals";

export const Route = createFileRoute("/marketplace/service/$serviceSlug")({
  loader: async ({ params }) => {
    const { offers } = await listMarketplaceOffers();
    const filtered = (offers as MarketplaceOfferLike[]).filter(
      (o) => o.service_slug === params.serviceSlug,
    );
    if (filtered.length === 0 && !offers.some((o: MarketplaceOfferLike) => o.service_slug === params.serviceSlug)) {
      // Aucune offre — on rend quand même la page avec état vide ; la route n'est pas inconnue.
    }
    const serviceName = filtered[0]?.service_name ?? params.serviceSlug;
    return { offers: filtered, serviceName, serviceSlug: params.serviceSlug };
  },
  component: ServicePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Service introuvable</h1>
      <Link to="/marketplace" className="mt-6 inline-block text-sm underline">
        Retour à la marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Erreur</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
    </div>
  ),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.serviceName ?? "Service"} — PartageCo` },
      {
        name: "description",
        content: `Toutes les offres de co-abonnement ${loaderData?.serviceName ?? ""} disponibles sur PartageCo.`,
      },
    ],
  }),
});

function ServicePage() {
  const { offers, serviceName } = Route.useLoaderData() as {
    offers: MarketplaceOfferLike[];
    serviceName: string;
    serviceSlug: string;
  };
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const plans = useMemo(() => {
    const set = new Map<string, string>();
    for (const o of offers) {
      if (o.plan_name) set.set(o.plan_name, o.plan_name);
    }
    return Array.from(set.values());
  }, [offers]);

  const baseFiltered = activePlan
    ? offers.filter((o) => o.plan_name === activePlan)
    : offers;

  const filtered = [...baseFiltered].sort((a, b) => {
    if (b.available_slots !== a.available_slots) return b.available_slots - a.available_slots;
    const pa = Number(a.monthly_price_amount);
    const pb = Number(b.monthly_price_amount);
    if (pa !== pb) return pa - pb;
    const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
    const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return cb - ca;
  });

  const showFilters = plans.length >= 2;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link to="/" className="text-base font-semibold tracking-tight">
            <span className="brand-wordmark">PartageCo</span>
          </Link>
          <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">
            ← Marketplace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{serviceName}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Offres de partage disponibles pour {serviceName}.
        </p>
        <div
          role="note"
          className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          <strong className="font-medium text-foreground">{MVP_NOTICE}</strong>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{NON_AFFILIATION_NOTICE}</p>

        {showFilters && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActivePlan(null)}
              className={`rounded-full border px-3 py-1 text-xs ${
                activePlan === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes
            </button>
            {plans.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePlan(p)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  activePlan === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <section className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
            <h2 className="text-base font-medium">
              Aucune offre disponible pour ce service pour le moment.
            </h2>
          </section>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((o) => (
              <li key={o.id}>
                <OfferCard offer={o} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
