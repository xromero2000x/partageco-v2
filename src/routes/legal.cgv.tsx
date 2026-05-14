import { createFileRoute } from "@tanstack/react-router";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const Route = createFileRoute("/legal/cgv")({
  component: Page,
  head: () => ({
    meta: [
      { title: "Conditions générales de vente — PartageCo" },
      { name: "description", content: "Conditions générales de vente de PartageCo." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Page() {
  return (
    <LegalLayout title="Conditions générales de vente" updatedAt="14 mai 2026">
      <h2>1. Champ d'application</h2>
      <p>
        Les présentes CGV s'appliquent aux participations payantes proposées via la
        plateforme PartageCo. Le propriétaire (vendeur) reste seul détenteur de son
        abonnement auprès du service tiers ; PartageCo facilite la mise en relation
        et l'encaissement.
      </p>

      <h2>2. Tarif et facturation</h2>
      <p>
        Le prix mensuel est fixé librement par chaque propriétaire. Une commission de
        plateforme est prélevée sur chaque participation. Les montants affichés
        s'entendent toutes taxes comprises (TTC).
      </p>

      <h2>3. Paiement</h2>
      <p>
        Le paiement s'effectue mensuellement. Pendant la phase MVP, aucun paiement
        réel n'est exécuté : les transactions sont simulées à des fins de test.
      </p>

      <h2>4. Activation et accès</h2>
      <p>
        L'accès à l'abonnement partagé est confirmé par le propriétaire après
        validation du paiement. Le participant dispose d'un délai raisonnable pour
        signaler tout problème via la messagerie interne.
      </p>

      <h2>5. Droit de rétractation</h2>
      <p>
        Conformément à l'article L221-28 du Code de la consommation, le service
        consistant en la fourniture d'un contenu numérique exécuté immédiatement
        avec accord exprès du participant ne fait pas l'objet d'un droit de
        rétractation.
      </p>

      <h2>6. Annulation et remboursement</h2>
      <p>
        Le participant peut résilier sa participation à tout moment depuis son espace.
        Le mois entamé n'est pas remboursé sauf défaillance avérée du propriétaire.
      </p>

      <h2>7. Litige et médiation</h2>
      <p>
        En cas de litige, l'utilisateur peut ouvrir une procédure depuis la
        messagerie. Conformément à l'article L612-1 du Code de la consommation, le
        consommateur a la possibilité de recourir gratuitement à un médiateur de la
        consommation.
      </p>

      <h2>8. Service client</h2>
      <p>Contact : support@partageco.example (modèle MVP).</p>
    </LegalLayout>
  );
}
