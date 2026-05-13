import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { listCategories, listServices, listServicePlans, createOffer } from "@/lib/offers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const OFFER_ERROR_MAP: Record<string, string> = {
  service_not_available: "Ce service n'est pas disponible.",
  category_not_available: "Cette catégorie n'est pas disponible.",
  service_category_mismatch: "Le service sélectionné ne correspond pas à la catégorie choisie.",
  service_plan_required: "Veuillez sélectionner une gamme d'abonnement.",
  service_plan_not_available: "Cette gamme d'abonnement n'est pas disponible.",
  service_plan_service_mismatch: "La gamme sélectionnée ne correspond pas au service choisi.",
  account_not_active: "Votre compte doit être actif pour créer une offre.",
  email_not_verified: "Votre email doit être vérifié pour créer une offre.",
  create_failed: "La création de l'offre a échoué.",
  generic_error: "Une erreur est survenue.",
};

export const Route = createFileRoute("/_authenticated/mes-offres/nouvelle")({
  component: NewOfferPage,
  head: () => ({ meta: [{ title: "Nouvelle offre — PartageCo" }] }),
});

function NewOfferPage() {
  const navigate = useNavigate();
  const fetchCats = useServerFn(listCategories);
  const fetchSvcs = useServerFn(listServices);
  const fetchPlans = useServerFn(listServicePlans);
  const submit = useServerFn(createOffer);
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => fetchCats() });
  const [categoryId, setCategoryId] = useState("");
  const svcs = useQuery({
    queryKey: ["services", categoryId],
    queryFn: () => fetchSvcs({ data: { categoryId: categoryId || undefined } }),
    enabled: !!categoryId,
  });
  const [serviceId, setServiceId] = useState("");
  const plans = useQuery({
    queryKey: ["service-plans", serviceId],
    queryFn: () => fetchPlans({ data: { serviceId } }),
    enabled: !!serviceId,
  });
  const [servicePlanId, setServicePlanId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [totalSlots, setTotalSlots] = useState(2);
  const [price, setPrice] = useState(5);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await submit({
        data: {
          service_id: serviceId,
          category_id: categoryId,
          service_plan_id: servicePlanId,
          title: title.trim(),
          description: description.trim() || null,
          total_slots: totalSlots,
          monthly_price_amount: price,
        },
      });
      toast.success("Offre créée en brouillon.");
      navigate({ to: "/mes-offres/$offerId", params: { offerId: res.id } });
    } catch (e) {
      const code = e instanceof Error ? e.message : "generic_error";
      setErr(OFFER_ERROR_MAP[code] ?? "Une erreur est survenue.");
    } finally {
      setBusy(false);
    }
  };

  const noPlanAvailable = !!serviceId && plans.data && plans.data.plans.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link to="/mes-offres" className="text-sm text-muted-foreground hover:text-foreground">
        ← Mes offres
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">Nouvelle offre</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        L'offre sera créée en brouillon privé. Elle ne sera publique qu'après acceptation par la modération.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Les noms de services sont utilisés uniquement pour décrire les abonnements partagés par les
        utilisateurs. PartageCo n'est affilié à aucun service cité.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="cat">Catégorie</Label>
          <select
            id="cat"
            value={categoryId}
            onChange={(e) => { setCategoryId(e.target.value); setServiceId(""); setServicePlanId(""); }}
            required
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {(cats.data?.categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {cats.data && cats.data.categories.length === 0 && (
            <p className="text-xs text-muted-foreground">Aucune catégorie active disponible.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="svc">Service</Label>
          <select
            id="svc"
            value={serviceId}
            onChange={(e) => { setServiceId(e.target.value); setServicePlanId(""); }}
            required
            disabled={!categoryId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Choisir —</option>
            {(svcs.data?.services ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          {categoryId && svcs.data && svcs.data.services.length === 0 && (
            <p className="text-xs text-destructive">
              Aucun service actif n'est disponible pour cette catégorie. La création est impossible.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="plan">Gamme d'abonnement</Label>
          <select
            id="plan"
            value={servicePlanId}
            onChange={(e) => setServicePlanId(e.target.value)}
            required
            disabled={!serviceId}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">— Choisir —</option>
            {(plans.data?.plans ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {noPlanAvailable && (
            <p className="text-xs text-destructive">
              Aucune gamme active n'est disponible pour ce service. Contactez l'administrateur.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Titre</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} maxLength={120} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={4} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="slots">Nombre total de places</Label>
            <Input id="slots" type="number" min={1} max={50} value={totalSlots} onChange={(e) => setTotalSlots(Number(e.target.value))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price">Montant indicatif mensuel (EUR)</Label>
            <Input id="price" type="number" min={0.01} step={0.01} max={10000} value={price} onChange={(e) => setPrice(Number(e.target.value))} required />
          </div>
        </div>

        {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

        <Button type="submit" disabled={busy || !serviceId || !servicePlanId}>
          {busy ? "Création…" : "Créer en brouillon"}
        </Button>
      </form>
    </div>
  );
}
