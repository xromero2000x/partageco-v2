import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminDisputes } from "@/lib/disputes.functions";

export const Route = createFileRoute("/_authenticated/admin/litiges/")({
  component: AdminDisputesPage,
  head: () => ({ meta: [{ title: "Admin — Litiges" }] }),
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function AdminDisputesPage() {
  const fn = useServerFn(listAdminDisputes);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: () => fn(),
    retry: false,
  });

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-destructive">Accès réservé aux administrateurs.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-xl font-semibold">Litiges (back-office)</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Aucune décision financière automatique ne sera prise dans le MVP.
      </p>

      {isLoading ? (
        <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>
      ) : !data?.disputes.length ? (
        <p className="mt-6 text-sm text-muted-foreground">Aucun litige.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {data.disputes.map((d) => (
            <li key={d.id}>
              <Link
                to="/admin/litiges/$disputeId"
                params={{ disputeId: d.id }}
                className="block rounded-lg border border-border bg-card p-3 hover:bg-accent"
              >
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">#{d.id.slice(0, 8)}</div>
                    <div className="text-xs text-muted-foreground">
                      Motif {d.dispute_reason} · Statut {d.dispute_status}
                      {d.assigned_admin_user_id ? " · assigné" : ""}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">{fmt(d.created_at)}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
