import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listAdminOffers,
  getAdminContext,
  acceptOffer,
  rejectOffer,
} from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/offres")({
  component: AdminOffersPage,
  head: () => ({ meta: [{ title: "Modération des offres — Admin" }] }),
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  pending_review: "En modération",
  active: "Active",
  paused: "En pause",
  rejected: "Rejetée",
  archived: "Archivée",
};

function AdminOffersPage() {
  const qc = useQueryClient();
  const ctxFn = useServerFn(getAdminContext);
  const listFn = useServerFn(listAdminOffers);
  const acceptFn = useServerFn(acceptOffer);
  const rejectFn = useServerFn(rejectOffer);
  const ctx = useQuery({ queryKey: ["admin-ctx"], queryFn: () => ctxFn() });
  const list = useQuery({
    queryKey: ["admin-offers"],
    queryFn: () => listFn({ data: {} }),
    enabled: !!ctx.data?.isAnyAdmin,
  });
  const [busy, setBusy] = useState(false);

  if (ctx.isLoading) return <p className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">Chargement…</p>;
  if (!ctx.data?.isAnyAdmin)
    return (
      <div className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cette section est réservée aux administrateurs.</p>
        <Link to="/dashboard" className="mt-6 inline-block text-sm underline">Retour</Link>
      </div>
    );

  const run = async (label: string, fn: () => Promise<unknown>) => {
    if (!confirm(`${label} ? Cette action sera journalisée.`)) return;
    setBusy(true);
    try {
      await fn();
      toast.success("Action effectuée.");
      await qc.invalidateQueries({ queryKey: ["admin-offers"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Modération des offres</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {ctx.data.isSuper ? "Super admin" : ctx.data.isModerator ? "Modération" : "Lecture seule"}
      </p>

      {list.isLoading && <p className="mt-8 text-sm text-muted-foreground">Chargement…</p>}
      {list.data && list.data.offers.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Aucune offre.</p>
      )}
      {list.data && list.data.offers.length > 0 && (
        <table className="mt-8 w-full border-separate border-spacing-y-2 text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-1">Offre</th><th>Propriétaire</th><th>Statut</th><th>Places</th><th>Montant</th><th></th></tr>
          </thead>
          <tbody>
            {list.data.offers.map((o) => {
              const owner = (o as unknown as { owner_profile?: { display_name?: string } | null }).owner_profile;
              const cat = (o as unknown as { category?: { name?: string } | null }).category;
              const svc = (o as unknown as { service?: { name?: string } | null }).service;
              const isPending = o.offer_status === "pending_review";
              return (
                <tr key={o.id} className="rounded border border-border bg-card">
                  <td className="px-3 py-2">
                    <Link to="/admin/offres/$offerId" params={{ offerId: o.id }} className="font-medium hover:underline">
                      {o.title}
                    </Link>
                    <div className="text-xs text-muted-foreground">{svc?.name} · {cat?.name}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">{owner?.display_name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{STATUS_LABEL[o.offer_status] ?? o.offer_status}</td>
                  <td className="px-3 py-2 text-xs">{o.available_slots}/{o.total_slots}</td>
                  <td className="px-3 py-2 text-xs">{o.monthly_price_amount} {o.currency}</td>
                  <td className="px-3 py-2 text-right">
                    {isPending && list.data.canModerate && (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" disabled={busy} onClick={() => run("Accepter cette offre", () => acceptFn({ data: { offerId: o.id } }))}>
                          Accepter
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => run("Rejeter cette offre", () => rejectFn({ data: { offerId: o.id } }))}>
                          Rejeter
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
