import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  getAdminContext,
  getAdminOffer,
  acceptOffer,
  rejectOffer,
  archiveOffer,
} from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/offres/$offerId")({
  component: AdminOfferDetailPage,
  head: () => ({ meta: [{ title: "Détail offre — Admin" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "En modération",
  active: "Active",
  paused: "En pause",
  rejected: "Rejetée",
  archived: "Archivée",
};

const ALLOWED_ARCHIVE_FROM = new Set(["draft", "rejected", "paused"]);

function AdminOfferDetailPage() {
  const { offerId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const ctxFn = useServerFn(getAdminContext);
  const fetchOffer = useServerFn(getAdminOffer);
  const acceptFn = useServerFn(acceptOffer);
  const rejectFn = useServerFn(rejectOffer);
  const archiveFn = useServerFn(archiveOffer);

  const ctx = useQuery({ queryKey: ["admin-ctx"], queryFn: () => ctxFn() });
  const detail = useQuery({
    queryKey: ["admin-offer", offerId],
    queryFn: () => fetchOffer({ data: { offerId } }),
    enabled: !!ctx.data?.isAnyAdmin,
  });
  const [busy, setBusy] = useState(false);

  if (ctx.isLoading) {
    return <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (!ctx.data?.isAnyAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette section est réservée aux administrateurs.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-sm underline">Retour</Link>
      </div>
    );
  }

  if (detail.isLoading) {
    return <p className="mx-auto max-w-3xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  }
  if (detail.error || !detail.data) {
    return <p role="alert" className="mx-auto max-w-3xl px-6 py-10 text-sm text-destructive">Offre introuvable.</p>;
  }

  const o = detail.data.offer as Record<string, unknown> & {
    id: string; title: string; offer_status: string; visibility: string;
    available_slots: number; total_slots: number; monthly_price_amount: number | string;
    currency: string; created_at: string; archived_at: string | null; description: string | null;
  };
  const ownerProfile = o.owner_profile as { display_name?: string } | null;
  const cat = o.category as { name?: string } | null;
  const svc = o.service as { name?: string } | null;

  const canModerate = detail.data.canModerate && o.offer_status === "pending_review";
  const canArchive = detail.data.canArchive && ALLOWED_ARCHIVE_FROM.has(o.offer_status);

  const run = async (label: string, action: () => Promise<unknown>, redirect = false) => {
    if (!confirm(`${label} ? Cette action sera journalisée.`)) return;
    setBusy(true);
    try {
      await action();
      toast.success("Action effectuée.");
      await qc.invalidateQueries({ queryKey: ["admin-offer", offerId] });
      await qc.invalidateQueries({ queryKey: ["admin-offers"] });
      if (redirect) navigate({ to: "/admin/offres" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link to="/admin/offres" className="text-sm text-muted-foreground hover:text-foreground">← Modération des offres</Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{o.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Statut : {STATUS_LABEL[o.offer_status] ?? o.offer_status} · Visibilité : {o.visibility}
      </p>

      <section className="mt-6 rounded-lg border border-border p-6 text-sm">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">Propriétaire</dt><dd>{ownerProfile?.display_name ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Catégorie</dt><dd>{cat?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Service</dt><dd>{svc?.name ?? "—"}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Places</dt><dd>{o.available_slots} / {o.total_slots}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Montant indicatif mensuel</dt><dd>{String(o.monthly_price_amount)} {o.currency}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Créée le</dt><dd>{new Date(o.created_at).toLocaleDateString("fr-FR")}</dd></div>
          {o.archived_at && (
            <div><dt className="text-xs text-muted-foreground">Archivée le</dt><dd>{new Date(o.archived_at).toLocaleDateString("fr-FR")}</dd></div>
          )}
        </dl>
        {o.description && (
          <div className="mt-6">
            <dt className="text-xs text-muted-foreground">Description</dt>
            <dd className="mt-1 whitespace-pre-line text-muted-foreground">{o.description}</dd>
          </div>
        )}
      </section>

      {(canModerate || canArchive) && (
        <section className="mt-6 flex flex-wrap gap-3">
          {canModerate && (
            <>
              <Button disabled={busy} onClick={() => run("Accepter cette offre", () => acceptFn({ data: { offerId } }))}>
                Accepter
              </Button>
              <Button variant="outline" disabled={busy} onClick={() => run("Rejeter cette offre", () => rejectFn({ data: { offerId } }))}>
                Rejeter
              </Button>
            </>
          )}
          {canArchive && (
            <Button variant="outline" disabled={busy} onClick={() => run("Archiver cette offre", () => archiveFn({ data: { offerId } }), true)}>
              Archiver
            </Button>
          )}
        </section>
      )}
      {!canModerate && !canArchive && (
        <p className="mt-6 text-xs text-muted-foreground">Aucune action disponible pour votre rôle dans le statut courant.</p>
      )}
    </div>
  );
}
