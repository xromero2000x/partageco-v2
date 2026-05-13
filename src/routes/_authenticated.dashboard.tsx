import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Tableau de bord — PartageCo" }] }),
});

function DashboardPage() {
  const { profile, appUser, isEmailVerified } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bonjour {profile?.display_name ?? ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bienvenue sur votre espace personnel.
        </p>
      </header>

      <div
        role="note"
        className="mb-6 rounded-md border border-border bg-muted/40 p-4 text-sm text-muted-foreground"
      >
        <strong className="font-medium text-foreground">
          Simulation MVP — aucun paiement réel n'est exécuté.
        </strong>
      </div>

      {!isEmailVerified && (
        <div
          role="alert"
          className="mb-6 rounded-md border border-border bg-card p-4 text-sm"
        >
          <h2 className="font-medium">Email non vérifié</h2>
          <p className="mt-1 text-muted-foreground">
            Votre compte est en statut « en attente de vérification ». Vous
            pourrez créer une offre, demander une participation, envoyer un
            message ou ouvrir un litige une fois votre adresse confirmée.
          </p>
        </div>
      )}

      <nav aria-label="Accès rapide" className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/marketplace"
          className="group rounded-lg border border-border p-6 transition hover:border-primary/50"
        >
          <h2 className="text-base font-medium group-hover:text-primary">Marketplace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Parcourez les offres de partage disponibles par service.
          </p>
        </Link>
        <Link
          to="/mes-offres/nouvelle"
          className="group rounded-lg border border-border p-6 transition hover:border-primary/50"
        >
          <h2 className="text-base font-medium group-hover:text-primary">Créer une offre</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Proposez un abonnement à partager. L'offre sera examinée avant publication.
          </p>
        </Link>
        <Link
          to="/mes-offres"
          className="group rounded-lg border border-border p-6 transition hover:border-primary/50"
        >
          <h2 className="text-base font-medium group-hover:text-primary">Mes offres</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Gérez vos offres publiées, en modération ou en brouillon.
          </p>
        </Link>
        <Link
          to="/mes-participations"
          className="group rounded-lg border border-border p-6 transition hover:border-primary/50"
        >
          <h2 className="text-base font-medium group-hover:text-primary">Mes participations</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Suivez les abonnements auxquels vous participez.
          </p>
        </Link>
      </nav>

      <p className="mt-10 text-xs text-muted-foreground">
        Statut du compte : {appUser?.account_status}
      </p>
    </div>
  );
}
