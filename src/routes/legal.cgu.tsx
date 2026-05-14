import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/legal/cgu")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — PartageCo" },
      { name: "description", content: "Conditions générales d'utilisation de PartageCo." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <LegalLayout title="Conditions générales d'utilisation" updatedAt="14 mai 2026">
      <h2>1. Objet</h2>
      <p>
        PartageCo est une marketplace permettant à des particuliers de partager les
        places disponibles d'abonnements à des services tiers (streaming, musique, etc.).
        Les présentes CGU régissent l'accès et l'utilisation du service.
      </p>

      <h2>2. Inscription et compte</h2>
      <p>
        L'inscription est réservée aux personnes majeures résidant dans l'Union
        européenne. L'utilisateur garantit l'exactitude des informations communiquées
        et est seul responsable de la confidentialité de ses identifiants.
      </p>

      <h2>3. Rôle de la plateforme</h2>
      <p>
        PartageCo agit en qualité d'intermédiaire technique. La plateforme n'est ni
        propriétaire ni distributrice des abonnements partagés. Elle n'est affiliée
        à aucun des services tiers cités.
      </p>

      <h2>4. Obligations des utilisateurs</h2>
      <ul>
        <li>Respecter les conditions des services tiers concernés.</li>
        <li>Ne pas partager d'identifiants en dehors des outils prévus.</li>
        <li>Communiquer de bonne foi via la messagerie interne.</li>
        <li>Ne pas tenter de contourner les mécanismes de paiement.</li>
      </ul>

      <h2>5. Litiges entre utilisateurs</h2>
      <p>
        En cas de différend, un litige peut être ouvert depuis la messagerie. L'équipe
        modération peut suspendre l'accès, geler un paiement préparatoire ou retirer
        une offre.
      </p>

      <h2>6. Suspension et suppression</h2>
      <p>
        PartageCo se réserve le droit de suspendre ou de supprimer un compte en cas de
        manquement, fraude ou usage non conforme. L'utilisateur peut demander la
        suppression de son compte depuis l'espace Sécurité.
      </p>

      <h2>7. Limitation de responsabilité</h2>
      <p>
        PartageCo n'est pas responsable des décisions prises par les éditeurs des
        services tiers (modification des abonnements, fermeture de comptes, etc.).
      </p>

      <h2>8. Modification des CGU</h2>
      <p>
        Les CGU peuvent évoluer. Les utilisateurs sont notifiés de toute modification
        substantielle au moins 15 jours avant l'entrée en vigueur.
      </p>

      <h2>9. Droit applicable</h2>
      <p>
        Les présentes sont soumises au droit français. Tout litige relève des
        tribunaux français compétents, sous réserve des dispositions impératives
        applicables aux consommateurs.
      </p>
    </LegalLayout>
  );
}
