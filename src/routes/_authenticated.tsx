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
      <main>
        <Outlet />
      </main>
    </div>
  );
}

