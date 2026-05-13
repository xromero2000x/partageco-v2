import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationLinks,
  type NotificationLink,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: NotificationsPage,
});

const TYPE_LABEL: Record<NotificationRow["notification_type"], string> = {
  email_verification: "Vérification email",
  participation_request: "Demande de participation",
  participation_status_changed: "Statut participation",
  message_received: "Message reçu",
  dispute_updated: "Litige",
  admin_action: "Action administrative",
};

function LinkForResolved({ link }: { link: NotificationLink }) {
  switch (link.kind) {
    case "offer_owner":
      return (
        <Link
          to="/mes-offres/$offerId"
          params={{ offerId: link.offerId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "offer_public":
      return (
        <Link
          to="/marketplace/$offerId"
          params={{ offerId: link.offerId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "co_subscription_subscriber":
      return (
        <Link
          to="/mes-participations/$coSubId"
          params={{ coSubId: link.coSubId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "co_subscription_owner":
      return (
        <Link
          to="/mes-offres/$offerId"
          params={{ offerId: link.offerId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "dispute_party":
      return (
        <Link
          to="/litiges/$disputeId"
          params={{ disputeId: link.disputeId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "dispute_admin":
      return (
        <Link
          to="/admin/litiges/$disputeId"
          params={{ disputeId: link.disputeId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    case "message":
      return (
        <Link
          to="/messages/$conversationId"
          params={{ conversationId: link.conversationId }}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Ouvrir
        </Link>
      );
    default:
      return null;
  }
}

function NotificationsPage() {
  const list = useServerFn(listMyNotifications);
  const resolve = useServerFn(resolveNotificationLinks);
  const markOne = useServerFn(markNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["notifications", "mine"],
    queryFn: () => list(),
  });

  const items = data?.notifications ?? [];
  const ids = items.map((n) => n.id);

  const linksQuery = useQuery({
    queryKey: ["notifications", "links", ids.join(",")],
    queryFn: () => resolve({ data: { notification_ids: ids } }),
    enabled: ids.length > 0,
  });
  const links = linksQuery.data?.links ?? {};

  const hasUnread = items.some((n) => !n.read_at);

  const onMarkOne = async (id: string) => {
    setBusy(true);
    try {
      await markOne({ data: { notification_id: id } });
      toast.success("Notification lue");
      await router.invalidate();
    } catch {
      toast.error("Erreur");
    } finally {
      setBusy(false);
    }
  };

  const onMarkAll = async () => {
    setBusy(true);
    try {
      await markAll();
      toast.success("Notification lue");
      await router.invalidate();
    } catch {
      toast.error("Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        {hasUnread && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void onMarkAll()}>
            Tout marquer comme lu
          </Button>
        )}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {error && (
        <p className="text-sm text-destructive">
          Une erreur est survenue lors du chargement.
        </p>
      )}
      {!isLoading && !error && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Vous n’avez aucune notification.</p>
      )}

      <ul className="space-y-3">
        {items.map((n) => {
          const link = links[n.id] ?? null;
          const unread = !n.read_at;
          return (
            <li
              key={n.id}
              className={`rounded-lg border p-4 ${unread ? "border-primary/40 bg-accent/30" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={unread ? "default" : "secondary"}>
                      {TYPE_LABEL[n.notification_type]}
                    </Badge>
                    {unread && <span className="text-xs text-muted-foreground">Non lu</span>}
                  </div>
                  <h2 className="mt-2 text-sm font-medium">{n.title}</h2>
                  <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                    {n.body}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {link && <LinkForResolved link={link} />}
                  {unread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onMarkOne(n.id)}
                    >
                      Marquer comme lu
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
