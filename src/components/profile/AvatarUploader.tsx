import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { updateMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function AvatarUploader({
  userId,
  displayName,
  avatarUrl,
  onChange,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  onChange: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const save = useServerFn(updateMyProfile);

  const onPick = () => inputRef.current?.click();

  const onFile = async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Format non supporté. Utilisez JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("L'image dépasse 5 Mo.");
      return;
    }
    setBusy(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?v=${Date.now()}`; // bust cache
      await save({ data: { avatar_url: url } });
      await onChange();
      toast.success("Photo de profil mise à jour.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de l'upload";
      toast.error(msg);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onRemove = async () => {
    if (!avatarUrl) return;
    if (!confirm("Supprimer la photo de profil ?")) return;
    setBusy(true);
    try {
      // Best-effort delete in storage (parse path after /avatars/)
      const m = avatarUrl.match(/\/avatars\/(.+?)(?:\?|$)/);
      if (m?.[1]) await supabase.storage.from("avatars").remove([m[1]]);
      await save({ data: { avatar_url: null } });
      await onChange();
      toast.success("Photo supprimée.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Échec de la suppression";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-5">
      <div
        aria-hidden="true"
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/80 to-primary text-2xl font-semibold text-primary-foreground"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(displayName)
        )}
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onPick} disabled={busy}>
            <Camera className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {avatarUrl ? "Changer" : "Ajouter une photo"}
          </Button>
          {avatarUrl && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              disabled={busy}
            >
              <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Retirer
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          JPG, PNG ou WebP — 5 Mo max. Visible publiquement sur votre profil.
        </p>
      </div>
    </div>
  );
}
