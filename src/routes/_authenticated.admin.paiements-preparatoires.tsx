import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminPayments } from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/paiements-preparatoires")({
  component: AdminPaymentsPage,
  head: () => ({ meta: [{ title: "Admin — Paiements préparatoires" }] }),
});

const PAYMENT_LABEL: Record<string, string> = {
  pending: "En attente de validation",
  simulated: "Validé en mode test",
  failed: "Échec simulé",
  cancelled: "Annulé",
};

const PARTICIPATION_LABEL: Record<string, string> = {
  requested: "Demandée",
  accepted_pending_payment: "Acceptée",
  active: "Active",
  cancelled: "Annulée",
  rejected: "Refusée",
  expired: "Expirée",
};

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function AdminPaymentsPage() {
  const fetchList = useServerFn(listAdminPayments);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: () => fetchList(),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div
        role="note"
        className="mb-6 rounded-md border border-border bg-muted/40 p-3 text-center text-sm font-medium"
      >
        Simulation MVP — aucun paiement réel n'est exécuté.
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Paiements préparatoires</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Consultation et validation des éléments préparatoires liés aux participations.
      </p>

      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p role="alert" className="mt-6 text-sm text-destructive">
          Accès refusé ou erreur de chargement.
        </p>
      )}

      {data && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Service</th>
                <th className="px-3 py-2">Gamme</th>
                <th className="px-3 py-2">Offre</th>
                <th className="px-3 py-2">Propriétaire</th>
                <th className="px-3 py-2">Co-abonné</th>
                <th className="px-3 py-2">Montant</th>
                <th className="px-3 py-2">Statut paiement</th>
                <th className="px-3 py-2">Statut participation</th>
                <th className="px-3 py-2">Créé le</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">
                    Aucun élément préparatoire.
                  </td>
                </tr>
              )}
              {data.items.map((it) => (
                <tr key={it.id} className="border-t border-border">
                  <td className="px-3 py-2">{it.service_name ?? "—"}</td>
                  <td className="px-3 py-2">{it.plan_name ?? "—"}</td>
                  <td className="px-3 py-2">{it.offer_title ?? "—"}</td>
                  <td className="px-3 py-2">{it.owner_display_name ?? "—"}</td>
                  <td className="px-3 py-2">{it.subscriber_display_name ?? "—"}</td>
                  <td className="px-3 py-2">
                    {it.gross_amount.toLocaleString("fr-FR", {
                      style: "currency",
                      currency: it.currency,
                    })}
                  </td>
                  <td className="px-3 py-2">
                    {PAYMENT_LABEL[it.payment_status] ?? it.payment_status}
                  </td>
                  <td className="px-3 py-2">
                    {it.participation_status
                      ? (PARTICIPATION_LABEL[it.participation_status] ?? it.participation_status)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{fmt(it.created_at)}</td>
                  <td className="px-3 py-2">
                    {it.payment_status === "pending" ? (
                      <Link
                        to="/admin/paiements-preparatoires/$paymentId"
                        params={{ paymentId: it.id }}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Valider →
                      </Link>
                    ) : (
                      <Link
                        to="/admin/paiements-preparatoires/$paymentId"
                        params={{ paymentId: it.id }}
                        className="text-muted-foreground underline-offset-4 hover:underline"
                      >
                        Détail
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
