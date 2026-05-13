import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getAdminPayment,
  simulatePaymentRecord,
  failPaymentRecord,
  cancelPaymentRecord,
} from "@/lib/payments.functions";

export const Route = createFileRoute("/_authenticated/admin/paiements-preparatoires/$paymentId")({
  component: AdminPaymentDetailPage,
  head: () => ({ meta: [{ title: "Admin — Détail paiement préparatoire" }] }),
});

const PAYMENT_LABEL: Record<string, string> = {
  pending: "En attente de simulation MVP",
  simulated: "Confirmé en simulation MVP",
  failed: "Échec simulé",
  cancelled: "Annulé",
};

const PARTICIPATION_LABEL: Record<string, string> = {
  requested: "Demandée",
  accepted_pending_payment: "Acceptée — préparation en cours",
  active: "Active",
  cancelled: "Annulée",
  rejected: "Refusée",
  expired: "Expirée",
};

const ERROR_MAP: Record<string, string> = {
  forbidden: "Action non autorisée.",
  not_found: "Élément introuvable.",
  transition_forbidden: "Transition non autorisée.",
  payment_not_simulation_compatible:
    "Cet élément ne peut pas être traité en simulation MVP.",
  generic_error: "Une erreur est survenue.",
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

function AdminPaymentDetailPage() {
  const { paymentId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchOne = useServerFn(getAdminPayment);
  const simulate = useServerFn(simulatePaymentRecord);
  const fail = useServerFn(failPaymentRecord);
  const cancel = useServerFn(cancelPaymentRecord);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-payment", paymentId],
    queryFn: () => fetchOne({ data: { paymentId } }),
  });

  const onAction = async (
    fn: (args: { data: { paymentId: string } }) => Promise<unknown>,
    confirmText: string,
    successText: string
  ) => {
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
      await fn({ data: { paymentId } });
      toast.success(successText);
      await qc.invalidateQueries({ queryKey: ["admin-payments"] });
      await refetch();
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      toast.error(ERROR_MAP[code] ?? code);
    } finally {
      setBusy(false);
    }
  };

  if (isLoading)
    return (
      <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>
    );
  if (error)
    return (
      <p role="alert" className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">
        Accès refusé ou erreur de chargement.
      </p>
    );
  if (!data) return null;

  const canAct = data.isSuper && data.payment.payment_status === "pending";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div
        role="note"
        className="mb-6 rounded-md border border-border bg-muted/40 p-3 text-center text-sm font-medium"
      >
        Simulation MVP — aucun paiement réel n'est exécuté.
      </div>

      <Link
        to="/admin/paiements-preparatoires"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Liste des paiements préparatoires
      </Link>

      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Paiement préparatoire
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Statut de simulation : {PAYMENT_LABEL[data.payment.payment_status] ?? data.payment.payment_status}
      </p>

      <section className="mt-6 rounded-lg border border-border p-6 text-sm">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">Identifiant</dt>
            <dd className="font-mono text-xs">{data.payment.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Offre liée</dt>
            <dd>{data.offer_title ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Propriétaire</dt>
            <dd>{data.owner_display_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Co-abonné</dt>
            <dd>{data.subscriber_display_name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Montant indicatif</dt>
            <dd>
              {data.payment.gross_amount.toLocaleString("fr-FR", {
                style: "currency",
                currency: data.payment.currency,
              })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Créé le</dt>
            <dd>{fmt(data.payment.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Statut participation</dt>
            <dd>
              {PARTICIPATION_LABEL[data.participation.participation_status] ??
                data.participation.participation_status}
            </dd>
          </div>
          {data.payment.platform_fee_amount !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Frais plateforme</dt>
              <dd>{Number(data.payment.platform_fee_amount)}</dd>
            </div>
          )}
          {data.payment.net_amount !== null && (
            <div>
              <dt className="text-xs text-muted-foreground">Montant net</dt>
              <dd>{Number(data.payment.net_amount)}</dd>
            </div>
          )}
        </dl>
      </section>

      {canAct && (
        <section className="mt-6 rounded-lg border border-border p-6 text-sm">
          <h2 className="text-base font-medium">Actions super_admin</h2>
          <p className="mt-1 text-xs italic text-muted-foreground">
            Simulation MVP — aucun paiement réel n'est exécuté.
          </p>
          <p className="text-xs text-muted-foreground">Cette action sera journalisée.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              disabled={busy}
              onClick={() =>
                onAction(
                  simulate,
                  "Confirmer sans paiement réel ? Cette action sera journalisée. Simulation MVP — aucun paiement réel n'est exécuté.",
                  "Élément confirmé en simulation MVP."
                )
              }
            >
              confirmer sans paiement réel
            </Button>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                onAction(
                  fail,
                  "Marquer comme échec simulé ? Cette action sera journalisée. Simulation MVP — aucun paiement réel n'est exécuté.",
                  "Élément marqué en échec simulé."
                )
              }
            >
              marquer comme échec simulé
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                onAction(
                  cancel,
                  "Annuler cet élément préparatoire ? Cette action sera journalisée. Simulation MVP — aucun paiement réel n'est exécuté.",
                  "Élément annulé."
                )
              }
            >
              annuler
            </Button>
          </div>
        </section>
      )}

      <div className="mt-6">
        <Button variant="ghost" onClick={() => navigate({ to: "/admin/paiements-preparatoires" })}>
          Retour
        </Button>
      </div>
    </div>
  );
}
