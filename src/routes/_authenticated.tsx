import {
  createFileRoute,
  Outlet,
  Link,
  useNavigate,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Menu } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/back-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const NAV_ITEMS = [
  { to: "/dashboard" as const, label: "Tableau de bord" },
  { to: "/marketplace" as const, label: "Marketplace" },
  { to: "/mes-offres" as const, label: "Mes offres" },
  { to: "/mes-participations" as const, label: "Mes participations" },
  { to: "/messages" as const, label: "Messages" },
  { to: "/litiges" as const, label: "Litiges" },
  { to: "/notifications" as const, label: "Notifications" },
  { to: "/profile" as const, label: "Profil" },
  { to: "/securite" as const, label: "Sécurité" },
];

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { loading, isAuthenticated, appUser, profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center text-sm text-muted-foreground"
      >
        Chargement…
      </div>
    );
  }
  if (!isAuthenticated) return null;

  // Account state gating
  if (appUser?.account_status === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Compte suspendu</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre compte est actuellement suspendu. Les actions de la marketplace
            ne sont pas disponibles. Contactez le support pour plus d'informations.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => void signOut()}>Se déconnecter</Button>
          </div>
        </div>
      </div>
    );
  }

  if (appUser?.account_status === "deletion_requested") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <h1 className="text-lg font-semibold">Suppression de compte en cours</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Une demande de suppression a été déposée pour votre compte. Les
            actions de la marketplace ne sont plus disponibles.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button onClick={() => void signOut()}>Se déconnecter</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-1">
            <BackButton fallback="/dashboard" />
            <Link
              to="/dashboard"
              className="ml-1 text-base font-semibold tracking-tight"
            >
              <span className="brand-wordmark">PartageCo</span>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav
            aria-label="Navigation principale"
            className="hidden items-center gap-1 lg:flex"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                activeProps={{
                  className:
                    "rounded-md px-3 py-1.5 text-sm bg-accent font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {profile?.display_name}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() =>
                void signOut().then(() => navigate({ to: "/" }))
              }
            >
              Déconnexion
            </Button>

            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Ouvrir le menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[85vw] max-w-sm">
                <SheetHeader>
                  <SheetTitle className="text-left">
                    <span className="brand-wordmark font-display text-xl italic">
                      PartageCo
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav
                  aria-label="Navigation mobile"
                  className="mt-6 flex flex-col gap-1 text-base"
                >
                  {NAV_ITEMS.map((item) => (
                    <SheetClose asChild key={item.to}>
                      <Link
                        to={item.to}
                        className="rounded-md px-3 py-2 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        activeProps={{
                          className:
                            "rounded-md px-3 py-2 bg-accent font-medium",
                        }}
                      >
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
                  <div className="mt-4 h-px bg-border" />
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="mt-4 rounded-full"
                      onClick={() =>
                        void signOut().then(() => navigate({ to: "/" }))
                      }
                    >
                      Déconnexion
                    </Button>
                  </SheetClose>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {appUser?.account_status === "pending_verification" && (
          <div
            role="status"
            aria-live="polite"
            className="border-t border-border bg-muted/40 px-6 py-2 text-center text-xs text-muted-foreground"
          >
            Votre adresse email n'est pas encore vérifiée. Les actions de la
            marketplace seront disponibles après vérification.
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
