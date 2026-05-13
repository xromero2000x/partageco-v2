import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminConversations } from "@/lib/messages.functions";

export const Route = createFileRoute("/_authenticated/admin/conversations")({
  component: AdminConversationsPage,
  head: () => ({ meta: [{ title: "Admin — Conversations" }] }),
});

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR");
  } catch {
    return iso;
  }
}

function AdminConversationsPage() {
  const fn = useServerFn(listAdminConversations);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => fn({}),
    retry: false,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Conversations (administration)</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Accès réservé au rôle super_admin. Toute consultation est journalisée
        (<code>admin_conversation_viewed</code>).
      </p>
      {isLoading && <p className="mt-6 text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="mt-6 text-sm text-destructive">
          {(error as Error).message === "forbidden"
            ? "Accès réservé aux administrateurs."
            : "Une erreur est survenue."}
        </p>
      )}
      {data && data.conversations.length === 0 && (
        <p className="mt-8 text-sm text-muted-foreground">Aucune conversation.</p>
      )}
      {data && data.conversations.length > 0 && (
        <ul className="mt-6 space-y-2">
          {data.conversations.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-border bg-card p-3 text-sm"
            >
              <div>
                <div className="font-medium">{c.conversation_type}</div>
                <div className="text-xs text-muted-foreground">{fmt(c.updated_at)}</div>
              </div>
              <Link
                to="/admin/conversations/$conversationId"
                params={{ conversationId: c.id }}
                className="text-primary hover:underline"
              >
                Consulter
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
