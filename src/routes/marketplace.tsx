import { createFileRoute, Link } from "@tanstack/react-router";
import { listMarketplaceOffers } from "@/lib/offers.functions";
import type { MarketplaceOfferLike } from "@/components/marketplace/OfferCard";
import { ServiceCard, type ServiceAggregate } from "@/components/marketplace/ServiceCard";
import {
  DISPLAY_CATEGORIES,
  MVP_NOTICE,
  NON_AFFILIATION_NOTICE,
} from "@/components/marketplace/serviceVisuals";

type OfferWithCreated = MarketplaceOfferLike & { created_at?: string };

export const Route = createFileRoute("/marketplace")({
  loader: () => listMarketplaceOffers(),
  component: MarketplacePage,
  head: () => ({
    meta: [
      { title: "Marketplace — PartageCo" },
      {
        name: "description",
        content:
          "Parcourez les offres de co-abonnement par catégorie et par service. Simulation MVP — aucun paiement réel n'est exécuté.",
      },
    ],
  }),
});

function aggregateByService(offers: OfferWithCreated[]): Map<string, ServiceAggregate> {
  const map = new Map<string, ServiceAggregate>();
  for (const o of offers) {
    if (!o.service_slug) continue;
    const price = Number(o.monthly_price_amount);
    const existing = map.get(o.service_slug);
    if (existing) {
      existing.offersCount += 1;
      existing.totalSlots += o.available_slots;
      if (price < existing.minPrice) existing.minPrice = price;
    } else {
      map.set(o.service_slug, {
        slug: o.service_slug,
        name: o.service_name ?? o.service_slug,
        offersCount: 1,
        totalSlots: o.available_slots,
        minPrice: price,
        currency: o.currency,
      });
    }
  }
  return map;
}

function MarketplacePage() {
  const { offers } = Route.useLoaderData() as { offers: OfferWithCreated[] };
  const aggregates = aggregateByService(offers);

  const sections = DISPLAY_CATEGORIES.map((cat) => {
    const services = cat.serviceSlugs
      .map((s) => aggregates.get(s))
      .filter((s): s is ServiceAggregate => Boolean(s));
    return { ...cat, services };
  }).filter((s) => s.services.length > 0);

  return (
    <div className="min-h-screen bg-background">

      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Marketplace</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choisissez une catégorie, puis un service pour voir les offres de partage proposées
          par les membres.
        </p>

        <div
          role="note"
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <strong className="font-medium text-foreground">{MVP_NOTICE}</strong>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">{NON_AFFILIATION_NOTICE}</p>

        {offers.length === 0 || sections.length === 0 ? (
          <section className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
            <h2 className="text-base font-medium">Aucune offre disponible pour le moment.</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              Aucune offre fictive n'est ajoutée à des fins de démonstration.
            </p>
          </section>
        ) : (
          <div className="mt-10 space-y-14">
            {sections.map((section) => (
              <section key={section.key}>
                <h2 className="text-xl font-semibold tracking-tight">{section.name}</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {section.services.length} service
                  {section.services.length > 1 ? "s" : ""} avec offres disponibles
                </p>
                <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {section.services.map((s) => (
                    <li key={s.slug}>
                      <ServiceCard service={s} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
