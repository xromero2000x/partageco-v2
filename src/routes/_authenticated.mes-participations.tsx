import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMyParticipations } from "@/lib/participations.functions";

export const Route = createFileRoute("/_authenticated/mes-participations")({
  component: MyParticipationsPage,
  head: () => ({ meta: [{ title: "Mes participations — PartageCo" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  requested: "Demandée",
  accepted_pending_payment: "Acceptée",
  active: "Active",
  cancelled: "Annulée",
  rejected: "Refusée",
  expired: "Expirée",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "En attente de simulation MVP",
  simulated: "Confirmé en simulation MVP",
  cancelled: "Annulé",
  failed: "Échec simulé",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function MyParticipationsPage() {
  const fetchList = useServerFn(listMyParticipations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-participations"],
    queryFn: () => fetchList(),
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Mes participations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Suivez l'état de vos demandes de participation aux offres.
      </p>

      {isLoading && (
        <p className="mt-8 text-sm text-muted-foreground">Chargement…</p>
      )}
      {error && (
        <p role="alert" className="mt-8 text-sm text-destructive">
          Impossible de charger vos participations.
        </p>
      )}
      {data && data.items.length === 0 && (
        <div className="mt-10 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Vous n'avez encore demandé à rejoindre aucune offre.
          <div className="mt-4">
            <Link to="/marketplace" className="text-primary underline-offset-4 hover:underline">
              Parcourir la marketplace
            </Link>
          </div>
        </div>
      )}
      {data && data.items.length > 0 && (
        <ul className="mt-8 space-y-3">
          {data.items.map((it) => {
            const offer = it.offer as {
              id: string;
              title: string;
              service_name?: string | null;
              plan_name?: string | null;
            } | null;
            const showPayment = !!it.payment;
            return (
              <li key={it.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Link
                      to="/mes-participations/$coSubId"
                      params={{ coSubId: it.id }}
                      className="text-base font-medium hover:underline"
                    >
                      {offer?.title ?? "Offre"}
                    </Link>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                      {offer?.service_name ?? "Service"}
                      {offer?.plan_name && (
                        <> · <span className="text-foreground normal-case">{offer.plan_name}</span></>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Demandée le {fmtDate(it.requested_at)}
                    </p>
                  </div>
                  <span className="rounded-md bg-muted px-2 py-1 text-xs">
                    {STATUS_LABEL[it.participation_status] ?? it.participation_status}
                  </span>
                </div>
                {showPayment && it.payment && (
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                    Statut de simulation : {PAYMENT_LABEL[it.payment.payment_status] ?? it.payment.payment_status}
                    <div className="mt-1 italic">
                      Simulation MVP — aucun paiement réel n'est exécuté.
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
