import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listMarketplaceOffers } from "@/lib/offers.functions";
import { OfferCard, type MarketplaceOfferLike } from "@/components/marketplace/OfferCard";
import {
  getServiceVisual,
  MVP_NOTICE,
  NON_AFFILIATION_NOTICE,
} from "@/components/marketplace/serviceVisuals";

type OfferWithCreated = MarketplaceOfferLike & { created_at?: string };

function formatPrice(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export const Route = createFileRoute("/marketplace_/service/$serviceSlug")({
  loader: async ({ params }) => {
    const { offers } = await listMarketplaceOffers();
    const filtered = (offers as OfferWithCreated[]).filter(
      (o) => o.service_slug === params.serviceSlug,
    );
    const first = filtered[0] ?? null;
    return {
      offers: filtered,
      serviceName: first?.service_name ?? params.serviceSlug,
      categoryName: first?.category_name ?? null,
      serviceSlug: params.serviceSlug,
    };
  },
  component: ServicePage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Service introuvable</h1>
      <Link
        to="/marketplace"
        className="mt-6 inline-block text-sm underline underline-offset-4"
      >
        Retour à la marketplace
      </Link>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      <Link
        to="/marketplace"
        className="mt-6 inline-block text-sm underline underline-offset-4"
      >
        Retour à la marketplace
      </Link>
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
  const { offers, serviceName, categoryName, serviceSlug } = Route.useLoaderData() as {
    offers: OfferWithCreated[];
    serviceName: string;
    categoryName: string | null;
    serviceSlug: string;
  };
  const { isAuthenticated } = useAuth();
  const [activePlan, setActivePlan] = useState<string | null>(null);

  const visual = getServiceVisual(serviceSlug);

  const stats = useMemo(() => {
    if (offers.length === 0) return null;
    const totalSlots = offers.reduce((sum, o) => sum + o.available_slots, 0);
    const minPrice = Math.min(...offers.map((o) => Number(o.monthly_price_amount)));
    const currency = offers[0]?.currency ?? "EUR";
    return { count: offers.length, totalSlots, minPrice, currency };
  }, [offers]);

  const plans = useMemo(() => {
    const seen = new Map<string, string>();
    for (const o of offers) {
      if (o.plan_name) seen.set(o.plan_name, o.plan_name);
    }
    return Array.from(seen.values());
  }, [offers]);

  const filtered = useMemo(() => {
    const base = activePlan
      ? offers.filter((o) => o.plan_name === activePlan)
      : offers;
    return [...base].sort((a, b) => {
      if (b.available_slots !== a.available_slots)
        return b.available_slots - a.available_slots;
      const pa = Number(a.monthly_price_amount);
      const pb = Number(b.monthly_price_amount);
      if (pa !== pb) return pa - pb;
      const ca = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cb - ca;
    });
  }, [offers, activePlan]);

  const showFilters = plans.length >= 2;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">

        {/* Back link */}
        <Link
          to="/marketplace"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          ← Marketplace
        </Link>

        {/* Service header */}
        <header className="mt-6">
          {visual && (
            <div className="mb-6 h-40 w-full overflow-hidden rounded-xl bg-muted sm:h-56">
              <img
                src={visual}
                alt=""
                aria-hidden="true"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <h1 className="text-3xl font-semibold tracking-tight">{serviceName}</h1>

          {categoryName && (
            <p className="mt-1 text-sm text-muted-foreground">{categoryName}</p>
          )}

          {stats && (
            <ul
              className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground"
              role="list"
              aria-label="Statistiques du service"
            >
              <li>
                <span className="font-medium text-foreground">{stats.count}</span>{" "}
                offre{stats.count > 1 ? "s" : ""} disponible{stats.count > 1 ? "s" : ""}
              </li>
              <li>
                <span className="font-medium text-foreground">{stats.totalSlots}</span>{" "}
                place{stats.totalSlots > 1 ? "s" : ""} au total
              </li>
              <li>
                À partir de{" "}
                <span className="font-medium text-foreground">
                  {formatPrice(stats.minPrice, stats.currency)}
                </span>
                /mois
              </li>
            </ul>
          )}
        </header>

        <div
          role="note"
          className="mt-4 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"
        >
          <strong className="font-medium text-foreground">{MVP_NOTICE}</strong>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{NON_AFFILIATION_NOTICE}</p>

        {/* Plan filters — displayed only when ≥ 2 distinct plans exist */}
        {showFilters && (
          <div
            className="mt-6 flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrer par gamme"
          >
            <button
              type="button"
              onClick={() => setActivePlan(null)}
              aria-pressed={activePlan === null}
              className={`rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                activePlan === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              Toutes les gammes
            </button>
            {plans.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setActivePlan(p)}
                aria-pressed={activePlan === p}
                className={`rounded-full border px-3 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
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

        {/* Offers grid or empty state */}
        {filtered.length === 0 ? (
          <section
            className="mt-10 rounded-lg border border-dashed border-border p-10 text-center"
            aria-label="Aucune offre disponible pour ce service"
          >
            <h2 className="text-base font-medium">
              Aucune offre disponible pour ce service.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Les offres apparaîtront ici lorsqu'un utilisateur proposera une place disponible.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                to="/marketplace"
                className="inline-flex items-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Retour à la marketplace
              </Link>
              {isAuthenticated && (
                <Link
                  to="/mes-offres/nouvelle"
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Créer une offre
                </Link>
              )}
            </div>
          </section>
        ) : (
          <ul
            className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            role="list"
            aria-label={`Offres ${serviceName}`}
          >
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
