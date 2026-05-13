import { Link, useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { BackButton } from "@/components/back-button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";

const VISITOR_NAV = [
  { to: "/" as const, label: "Accueil", exact: true },
  { to: "/marketplace" as const, label: "Offres" },
];

const AUTH_NAV = [
  { to: "/dashboard" as const, label: "Tableau de bord" },
  { to: "/marketplace" as const, label: "Marketplace" },
  { to: "/mes-offres" as const, label: "Mes offres" },
  { to: "/mes-participations" as const, label: "Mes participations" },
  { to: "/messages" as const, label: "Messages" },
  { to: "/notifications" as const, label: "Notifications" },
  { to: "/profile" as const, label: "Profil" },
];

export function SiteHeader() {
  const { isAuthenticated, loading, profile, appUser, signOut } = useAuth();
  const navigate = useNavigate();

  const items = isAuthenticated ? AUTH_NAV : VISITOR_NAV;
  const showPending =
    isAuthenticated && appUser?.account_status === "pending_verification";

  return (
    <header className="sticky top-0 z-50 px-4 pt-4 pb-3 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-border/60 bg-background/40 px-3 py-2 backdrop-blur-md sm:px-5 sm:py-3">
        <div className="flex items-center gap-1">
          <BackButton fallback="/" className="hidden sm:inline-flex" />
          <BackButton fallback="/" className="sm:hidden" label="" />
          <Link to="/" className="font-display text-xl italic">
            <span className="brand-wordmark">PartageCo</span>
          </Link>
        </div>

        <nav
          aria-label="Navigation principale"
          className="hidden items-center gap-6 text-sm text-muted-foreground lg:flex"
        >
          {items.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              activeOptions={"exact" in it && it.exact ? { exact: true } : undefined}
              className="hover:text-foreground"
              activeProps={{ className: "text-primary" }}
            >
              {it.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!loading && !isAuthenticated && (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link to="/login">Se connecter</Link>
              </Button>
              <Button asChild size="sm" className="hidden rounded-full sm:inline-flex">
                <Link to="/signup">Créer un compte</Link>
              </Button>
            </>
          )}
          {!loading && isAuthenticated && (
            <>
              {profile?.display_name && (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {profile.display_name}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="hidden rounded-full sm:inline-flex"
                onClick={() => void signOut().then(() => navigate({ to: "/" }))}
              >
                Déconnexion
              </Button>
            </>
          )}

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full lg:hidden"
                aria-label="Ouvrir le menu"
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm">
              <SheetHeader>
                <SheetTitle className="text-left font-display text-2xl italic">
                  <span className="brand-wordmark">PartageCo</span>
                </SheetTitle>
              </SheetHeader>
              <nav
                aria-label="Navigation mobile"
                className="mt-6 flex flex-col gap-1 text-base"
              >
                {items.map((it) => (
                  <SheetClose asChild key={it.to}>
                    <Link
                      to={it.to}
                      activeOptions={"exact" in it && it.exact ? { exact: true } : undefined}
                      className="rounded-md px-3 py-2 hover:bg-accent"
                      activeProps={{
                        className:
                          "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                      }}
                    >
                      {it.label}
                    </Link>
                  </SheetClose>
                ))}

                <div className="mt-4 h-px bg-border" />

                {!isAuthenticated ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <SheetClose asChild>
                      <Button asChild variant="outline" className="rounded-full">
                        <Link to="/login">Connexion</Link>
                      </Button>
                    </SheetClose>
                    <SheetClose asChild>
                      <Button asChild className="rounded-full">
                        <Link to="/signup">Créer un compte</Link>
                      </Button>
                    </SheetClose>
                  </div>
                ) : (
                  <SheetClose asChild>
                    <Button
                      variant="outline"
                      className="mt-4 rounded-full"
                      onClick={() => void signOut().then(() => navigate({ to: "/" }))}
                    >
                      Déconnexion
                    </Button>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {showPending && (
        <div
          role="status"
          aria-live="polite"
          className="mx-auto mt-2 max-w-6xl rounded-full border border-border/60 bg-muted/40 px-4 py-1.5 text-center text-xs text-muted-foreground"
        >
          Votre adresse email n'est pas encore vérifiée. Les actions de la
          marketplace seront disponibles après vérification.
        </div>
      )}
    </header>
  );
}
