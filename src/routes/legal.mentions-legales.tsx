import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/legal/mentions-legales")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Mentions légales — PartageCo" },
      { name: "description", content: "Mentions légales de l'éditeur PartageCo." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <LegalLayout title="Mentions légales" updatedAt="14 mai 2026">
      <h2>Éditeur</h2>
      <p>
        PartageCo (modèle MVP). Adresse postale, forme juridique et numéro
        d'immatriculation à compléter avant ouverture commerciale.
      </p>

      <h2>Directeur de la publication</h2>
      <p>À compléter.</p>

      <h2>Hébergement</h2>
      <p>
        Le site est hébergé sur une infrastructure cloud Edge fournie par Cloudflare,
        Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.
      </p>

      <h2>Contact</h2>
      <p>contact@partageco.example</p>

      <h2>Propriété intellectuelle</h2>
      <p>
        L'ensemble des éléments du site (textes, graphismes, code) est protégé. Toute
        reproduction sans autorisation préalable est interdite. Les marques tierces
        citées appartiennent à leurs détenteurs respectifs ; PartageCo n'est affilié
        à aucun de ces tiers.
      </p>
    </LegalLayout>
  );
}
