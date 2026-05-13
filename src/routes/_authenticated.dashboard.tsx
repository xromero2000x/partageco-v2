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

      <section className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-lg border border-border p-6">
          <h2 className="text-base font-medium">Mes offres</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous n'avez encore publié aucune offre.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            La création d'offres sera disponible dans les prochaines étapes du
            développement.
          </p>
        </article>
        <article className="rounded-lg border border-border p-6">
          <h2 className="text-base font-medium">Mes participations</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous ne participez à aucune offre pour le moment.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Découvrez les offres disponibles dans{" "}
            <Link to="/marketplace" className="underline">
              la marketplace
            </Link>
            .
          </p>
        </article>
      </section>

      <p className="mt-10 text-xs text-muted-foreground">
        Statut du compte : {appUser?.account_status}
      </p>
    </div>
  );
}
