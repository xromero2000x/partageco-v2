import { Link } from "@tanstack/react-router";

const COLS = [
  {
    title: "PartageCo",
    links: [
      { to: "/" as const, label: "Accueil" },
      { to: "/marketplace" as const, label: "Marketplace" },
    ],
  },
  {
    title: "Légal",
    links: [
      { to: "/legal/cgu" as const, label: "Conditions générales d'utilisation" },
      { to: "/legal/cgv" as const, label: "Conditions générales de vente" },
      { to: "/legal/confidentialite" as const, label: "Politique de confidentialité" },
      { to: "/legal/cookies" as const, label: "Cookies" },
      { to: "/legal/mentions-legales" as const, label: "Mentions légales" },
    ],
  },
];

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-border/60 bg-background/40">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="grid gap-8 sm:grid-cols-2">
          {COLS.map((c) => (
            <div key={c.title}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                {c.title}
              </h2>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {c.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-8 text-xs text-muted-foreground">
          © {year} PartageCo. Marketplace de partage d'abonnements entre
          particuliers. Simulation MVP — aucun paiement réel n'est exécuté.
        </p>
      </div>
    </footer>
  );
}
