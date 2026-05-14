import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/legal/cookies")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Cookies — PartageCo" },
      { name: "description", content: "Politique d'utilisation des cookies sur PartageCo." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <LegalLayout title="Gestion des cookies" updatedAt="14 mai 2026">
      <h2>Cookies strictement nécessaires</h2>
      <p>
        Ces cookies sont indispensables au fonctionnement du site (session,
        authentification, sécurité). Ils ne peuvent pas être désactivés.
      </p>

      <h2>Cookies de mesure d'audience</h2>
      <p>
        Aucun cookie de mesure d'audience ou publicitaire n'est déposé sur PartageCo
        sans votre consentement explicite. Lorsqu'un tel outil sera ajouté, vous
        pourrez accepter ou refuser depuis la bannière dédiée.
      </p>

      <h2>Stockage local</h2>
      <p>
        Le site utilise le stockage local du navigateur (<code>localStorage</code>) pour
        mémoriser votre choix concernant les cookies (clé{" "}
        <code>partageco.cookies.v1</code>). Vous pouvez le supprimer à tout moment
        depuis les outils de votre navigateur.
      </p>

      <h2>Vos préférences</h2>
      <p>
        Pour modifier vos choix, supprimez le stockage local du navigateur et
        rechargez la page : la bannière s'affichera à nouveau.
      </p>
    </LegalLayout>
  );
}
