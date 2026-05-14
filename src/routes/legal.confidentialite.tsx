import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/legal/confidentialite")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — PartageCo" },
      { name: "description", content: "Comment PartageCo collecte et protège vos données personnelles." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <LegalLayout title="Politique de confidentialité" updatedAt="14 mai 2026">
      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est PartageCo. Pour toute demande relative à vos
        données : privacy@partageco.example.
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>Identité : email, nom d'affichage, photo de profil, bio (facultatives).</li>
        <li>Activité : offres publiées, participations, messages, avis, paiements préparatoires.</li>
        <li>Techniques : journaux de connexion, adresse IP, agent utilisateur.</li>
      </ul>

      <h2>3. Finalités</h2>
      <ul>
        <li>Fournir le service de mise en relation.</li>
        <li>Sécuriser la plateforme et prévenir la fraude.</li>
        <li>Répondre aux obligations légales et comptables.</li>
      </ul>

      <h2>4. Bases légales</h2>
      <p>
        Exécution du contrat (article 6.1.b RGPD), intérêt légitime (sécurité),
        obligation légale (comptabilité), et consentement le cas échéant.
      </p>

      <h2>5. Durées de conservation</h2>
      <ul>
        <li>Compte actif : pendant toute la durée de votre inscription.</li>
        <li>Données comptables : 10 ans après la dernière transaction.</li>
        <li>Journaux de sécurité : 12 mois.</li>
      </ul>

      <h2>6. Destinataires</h2>
      <p>
        Vos données sont accessibles à l'équipe PartageCo et à nos sous-traitants
        techniques (hébergement, paiement). Aucune donnée n'est revendue.
      </p>

      <h2>7. Vos droits</h2>
      <p>
        Vous disposez des droits d'accès, de rectification, d'effacement, d'opposition,
        de limitation et de portabilité. Vous pouvez les exercer depuis votre espace
        Sécurité ou par email. Vous pouvez également introduire une réclamation
        auprès de la CNIL (www.cnil.fr).
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Les mots de passe sont stockés sous forme de hachages, les données transitent
        en HTTPS et l'accès aux outils internes est restreint aux administrateurs
        habilités. L'historique des actions sensibles est journalisé.
      </p>
    </LegalLayout>
  );
}
