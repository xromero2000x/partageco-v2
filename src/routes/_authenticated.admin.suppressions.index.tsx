import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { listAdminDeletionRequests } from "@/lib/deletion.functions";

export const Route = createFileRoute("/_authenticated/admin/suppressions/")({
  component: AdminDeletionListPage,
  head: () => ({ meta: [{ title: "Suppressions — Admin" }] }),
});

function AdminDeletionListPage() {
  const fetchList = useServerFn(listAdminDeletionRequests);
  const [rows, setRows] = useState<
    Awaited<ReturnType<typeof listAdminDeletionRequests>>["requests"]
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchList();
        setRows(r.requests);
      } catch (e) {
        const m = (e as Error).message ?? "";
        setError(m.includes("forbidden") ? "Accès réservé aux super administrateurs." : "Erreur de chargement.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Chargement…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Demandes de suppression</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Consultation administrative journalisée.
      </p>

      <div className="mt-6 overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2">Utilisateur</th>
              <th className="px-3 py-2">Statut</th>
              <th className="px-3 py-2">Demande</th>
              <th className="px-3 py-2">Traitée</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">
                  Aucune demande.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2">{r.display_name}</td>
                  <td className="px-3 py-2">{r.request_status}</td>
                  <td className="px-3 py-2">{new Date(r.requested_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      to="/admin/suppressions/$deletionRequestId"
                      params={{ deletionRequestId: r.id }}
                      className="text-primary hover:underline"
                    >
                      Détail
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
