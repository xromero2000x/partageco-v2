import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import heroNeon from "@/assets/hero-neon-heart.jpg";
import { AuthProvider } from "@/hooks/useAuth";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Cette page n'a pas pu se charger
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Une erreur est survenue. Vous pouvez réessayer ou revenir à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "PartageCo — Marketplace de partage d'abonnements" },
      {
        name: "description",
        content:
          "Marketplace de co-abonnement entre particuliers. Partagez vos abonnements existants en toute simplicité. Simulation MVP — aucun paiement réel n'est exécuté.",
      },
      { property: "og:title", content: "PartageCo — Marketplace de partage d'abonnements" },
      { name: "twitter:title", content: "PartageCo — Marketplace de partage d'abonnements" },
      { name: "description", content: "A web marketplace connecting subscription owners with available slots to users seeking reduced-cost shared subscriptions." },
      { property: "og:description", content: "A web marketplace connecting subscription owners with available slots to users seeking reduced-cost shared subscriptions." },
      { name: "twitter:description", content: "A web marketplace connecting subscription owners with available slots to users seeking reduced-cost shared subscriptions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f6becaf8-6095-49d4-9d37-838ccad94db8/id-preview-1ec1885b--4ee87e55-b88e-45ee-9023-4ba62f86185a.lovable.app-1778678753493.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/f6becaf8-6095-49d4-9d37-838ccad94db8/id-preview-1ec1885b--4ee87e55-b88e-45ee-9023-4ba62f86185a.lovable.app-1778678753493.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Arrière-plan global PartageCo */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-20 bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: `url(${heroNeon})` }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-background/70 via-background/85 to-background"
        />
        <SiteHeader />
        <Outlet />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
