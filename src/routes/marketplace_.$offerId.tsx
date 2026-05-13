// Public offer detail under /marketplace/$offerId — shares the same logic as
// /offres/$offerId. The trailing underscore makes this route flat (it does not
// nest inside marketplace.tsx).
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { getPublicOffer } from "@/lib/offers.functions";
import {
  getOfferActionAvailability,
  requestParticipation,
} from "@/lib/participations.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/marketplace_/$offerId")({
  loader: async ({ params }) => {
    try {
      return await getPublicOffer({ data: { offerId: params.offerId } });
    } catch {
      throw notFound();
    }
  },
  component: PublicOfferPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-xl font-semibold">Offre introuvable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette offre n'existe pas ou n'est plus publique.
      </p>
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
      { title: `${loaderData?.offer.title ?? "Offre"} — PartageCo` },
      {
        name: "description",
        content:
          "Détail d'une offre de co-abonnement. Simulation MVP — aucun paiement réel n'est exécuté.",
      },
    ],
  }),
});

const REASON_MESSAGES: Record<string, string> = {
  email_not_verified: "Vérifiez votre adresse email pour pouvoir demander à rejoindre.",
  account_suspended: "Votre compte est suspendu : action indisponible.",
  account_deletion_requested:
    "Une demande de suppression de votre compte est en cours : action indisponible.",
  offer_unavailable: "Cette offre n'est plus disponible.",
  offer_not_public: "Cette offre n'est plus disponible.",
  no_slots_available: "Plus aucune place disponible sur cette offre.",
  self_participation_forbidden:
    "Vous ne pouvez pas demander à rejoindre votre propre offre.",
  participation_already_exists:
    "Vous avez déjà une demande active sur cette offre.",
  action_not_authorized: "Action non autorisée.",
  generic_error: "Une erreur est survenue.",
};

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function PublicOfferPage() {
  const { offer } = Route.useLoaderData();
  const { offerId } = Route.useParams();
  const { isAuthenticated, loading } = useAuth();
  const qc = useQueryClient();
  const fetchAvail = useServerFn(getOfferActionAvailability);
  const requestFn = useServerFn(requestParticipation);
  const [busy, setBusy] = useState(false);

  const availability = useQuery({
    queryKey: ["offer-availability", offerId],
    queryFn: () => fetchAvail({ data: { offerId } }),
    enabled: !loading && isAuthenticated,
  });

  const onRequest = async () => {
    if (!confirm("Confirmer la demande de participation ? Cette action sera journalisée.")) return;
    setBusy(true);
    try {
      await requestFn({ data: { offerId } });
      toast.success("Demande envoyée.");
      await qc.invalidateQueries({ queryKey: ["my-participations"] });
      await availability.refetch();
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(REASON_MESSAGES[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

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

      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{offer.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {offer.service_name} · {offer.category_name}
        </p>

        <div
          role="note"
          className="mt-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
        >
          <strong className="font-medium text-foreground">
            Simulation MVP — aucun paiement réel n'est exécuté.
          </strong>
        </div>

        <section className="mt-8 rounded-lg border border-border p-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Montant indicatif mensuel</dt>
              <dd className="mt-1 text-lg font-medium">
                {formatAmount(Number(offer.monthly_price_amount), offer.currency)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Places disponibles</dt>
              <dd className="mt-1 text-lg font-medium">{offer.available_slots}</dd>
            </div>
          </dl>
          {offer.description && (
            <div className="mt-6">
              <h2 className="text-sm font-medium">Description</h2>
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
                {offer.description}
              </p>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-lg border border-dashed border-border p-6 text-center">
          {!loading && !isAuthenticated && (
            <Link
              to="/signup"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Créer un compte pour demander à rejoindre
            </Link>
          )}
          {!loading && isAuthenticated && (
            <>
              {availability.isLoading && (
                <p className="text-sm text-muted-foreground">Vérification…</p>
              )}
              {availability.data?.allowed && (
                <Button onClick={onRequest} disabled={busy}>
                  Demander à rejoindre
                </Button>
              )}
              {availability.data && !availability.data.allowed && (
                <p className="text-sm text-muted-foreground">
                  {REASON_MESSAGES[availability.data.reason ?? "generic_error"] ??
                    "Action non disponible."}
                </p>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
