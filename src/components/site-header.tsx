import { Link } from "@tanstack/react-router";
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

export function SiteHeader() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <header className="sticky top-0 z-50 px-4 pt-6 pb-4 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
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
          className="hidden items-center gap-8 text-sm text-muted-foreground md:flex"
        >
          <Link
            to="/"
            className="hover:text-foreground"
            activeOptions={{ exact: true }}
            activeProps={{ className: "text-primary" }}
          >
            Accueil
          </Link>
          <Link
            to="/marketplace"
            className="hover:text-foreground"
            activeProps={{ className: "text-primary" }}
          >
            Offres
          </Link>
          {isAuthenticated && (
            <>
              <Link
                to="/mes-participations"
                className="hover:text-foreground"
                activeProps={{ className: "text-primary" }}
              >
                Mes participations
              </Link>
              <Link
                to="/mes-offres"
                className="hover:text-foreground"
                activeProps={{ className: "text-primary" }}
              >
                Mes offres
              </Link>
            </>
          )}
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
            <Button asChild size="sm" className="rounded-full">
              <Link to="/dashboard">Mon espace</Link>
            </Button>
          )}
          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full md:hidden"
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
                <SheetClose asChild>
                  <Link
                    to="/"
                    activeOptions={{ exact: true }}
                    className="rounded-md px-3 py-2 hover:bg-accent"
                    activeProps={{
                      className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                    }}
                  >
                    Accueil
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/marketplace"
                    className="rounded-md px-3 py-2 hover:bg-accent"
                    activeProps={{
                      className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                    }}
                  >
                    Offres
                  </Link>
                </SheetClose>
                {isAuthenticated && (
                  <>
                    <SheetClose asChild>
                      <Link
                        to="/mes-participations"
                        className="rounded-md px-3 py-2 hover:bg-accent"
                        activeProps={{
                          className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                        }}
                      >
                        Mes participations
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/mes-offres"
                        className="rounded-md px-3 py-2 hover:bg-accent"
                        activeProps={{
                          className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                        }}
                      >
                        Mes offres
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/messages"
                        className="rounded-md px-3 py-2 hover:bg-accent"
                        activeProps={{
                          className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                        }}
                      >
                        Messages
                      </Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link
                        to="/notifications"
                        className="rounded-md px-3 py-2 hover:bg-accent"
                        activeProps={{
                          className: "rounded-md px-3 py-2 bg-accent font-medium text-primary",
                        }}
                      >
                        Notifications
                      </Link>
                    </SheetClose>
                  </>
                )}

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
                    <Button asChild className="mt-4 rounded-full">
                      <Link to="/dashboard">Mon espace</Link>
                    </Button>
                  </SheetClose>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
