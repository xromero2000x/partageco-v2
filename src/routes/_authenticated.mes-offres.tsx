import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyOffers } from "@/lib/offers.functions";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/mes-offres")({
  component: MyOffersPage,
  head: () => ({ meta: [{ title: "Mes offres — PartageCo" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "En modération",
  active: "Active",
  paused: "En pause",
  rejected: "Rejetée",
  archived: "Archivée",
};

function MyOffersPage() {
  const { isEmailVerified, appUser } = useAuth();
  const fetchOffers = useServerFn(listMyOffers);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-offers"],
    queryFn: () => fetchOffers(),
  });

  const canCreate = appUser?.account_status === "active" && isEmailVerified;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes offres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les offres de co-abonnement que vous proposez.
          </p>
        </div>
        {canCreate && (
          <Link
            to="/mes-offres/nouvelle"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Créer une offre
          </Link>
        )}
      </div>

      {!canCreate && (
        <div role="note" className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          La création d'offre nécessite un compte actif avec une adresse email vérifiée.
        </div>
      )}

      {isLoading && <p className="mt-8 text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p role="alert" className="mt-8 text-sm text-destructive">
          Impossible de charger vos offres.
        </p>
      )}
      {data && data.offers.length === 0 && (
        <section className="mt-10 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Vous n'avez créé aucune offre.</p>
        </section>
      )}
      {data && data.offers.length > 0 && (
        <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
          {data.offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1">
                <Link
                  to="/mes-offres/$offerId"
                  params={{ offerId: o.id }}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {o.title}
                </Link>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.service_name ?? "Service"}
                  {o.plan_name ? (
                    <> · <span className="text-foreground">{o.plan_name}</span></>
                  ) : (
                    <> · <span className="italic">Gamme à compléter</span></>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {STATUS_LABEL[o.offer_status] ?? o.offer_status} ·{" "}
                  {o.available_slots}/{o.total_slots} places ·{" "}
                  {Number(o.monthly_price_amount).toLocaleString("fr-FR", {
                    style: "currency",
                    currency: o.currency,
                  })}
                  /mois
                </p>
              </div>
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {new Date(o.created_at).toLocaleDateString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
