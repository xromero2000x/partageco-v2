import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminParticipations } from "@/lib/participations.functions";

export const Route = createFileRoute("/_authenticated/admin/participations")({
  component: AdminParticipationsPage,
  head: () => ({ meta: [{ title: "Admin — Participations" }] }),
});

function fmt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("fr-FR");
  } catch {
    return iso;
  }
}

function AdminParticipationsPage() {
  const fetchList = useServerFn(listAdminParticipations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-participations"],
    queryFn: () => fetchList(),
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Participations — lecture</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Consultation des participations. Aucune action n'est disponible à ce stade.
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
                <th className="px-3 py-2">Offre</th>
                <th className="px-3 py-2">Propriétaire</th>
                <th className="px-3 py-2">Co-abonné</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2">Demande</th>
                <th className="px-3 py-2">Acceptée</th>
                <th className="px-3 py-2">Activée</th>
                <th className="px-3 py-2">Annulée</th>
                <th className="px-3 py-2">Terminée</th>
              </tr>
            </thead>
            <tbody>
              {data.items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-muted-foreground">
                    Aucune participation.
                  </td>
                </tr>
              )}
              {data.items.map((it) => {
                const offer = it.offer as { title: string } | null;
                return (
                  <tr key={it.id} className="border-t border-border">
                    <td className="px-3 py-2">{offer?.title ?? "—"}</td>
                    <td className="px-3 py-2">{it.owner_display_name ?? "—"}</td>
                    <td className="px-3 py-2">{it.subscriber_display_name ?? "—"}</td>
                    <td className="px-3 py-2">{it.participation_status}</td>
                    <td className="px-3 py-2">{fmt(it.requested_at)}</td>
                    <td className="px-3 py-2">{fmt(it.accepted_at)}</td>
                    <td className="px-3 py-2">{fmt(it.activated_at)}</td>
                    <td className="px-3 py-2">{fmt(it.cancelled_at)}</td>
                    <td className="px-3 py-2">{fmt(it.ended_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
