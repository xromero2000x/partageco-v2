import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- Types ----------

export type PublicReview = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_display_name: string;
};

export type PublicProfile = {
  user_id: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  member_since: string | null;
  email_verified: boolean;
  active_offers_count: number;
  rating_avg: number | null;
  rating_count: number;
};

// ---------- Public profile + reviews ----------

export const getPublicProfile = createServerFn({ method: "GET" })
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }): Promise<{ profile: PublicProfile; reviews: PublicReview[] }> => {
    const [{ data: prof }, { data: u }, { count: activeOffers }, { data: reviews }] =
      await Promise.all([
        supabaseAdmin
          .from("user_profiles")
          .select("user_id,display_name,bio,avatar_url")
          .eq("user_id", data.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("users")
          .select("created_at,email_verified_at,account_status,deleted_at")
          .eq("id", data.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("subscription_offers")
          .select("id", { count: "exact", head: true })
          .eq("owner_user_id", data.userId)
          .eq("offer_status", "active")
          .eq("visibility", "public"),
        supabaseAdmin
          .from("reviews")
          .select("id,rating,comment,created_at,reviewer_user_id")
          .eq("reviewee_user_id", data.userId)
          .eq("is_published", true)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

    if (!u || u.deleted_at || u.account_status !== "active") {
      throw new Error("not_found");
    }

    const list = reviews ?? [];
    const reviewerIds = Array.from(new Set(list.map((r) => r.reviewer_user_id as string)));
    const nameMap = new Map<string, string>();
    if (reviewerIds.length > 0) {
      const { data: names } = await supabaseAdmin
        .from("user_profiles")
        .select("user_id,display_name")
        .in("user_id", reviewerIds);
      for (const n of names ?? []) nameMap.set(n.user_id as string, n.display_name as string);
    }

    const ratingCount = list.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((list.reduce((s, r) => s + (r.rating as number), 0) / ratingCount) * 10) / 10
        : null;

    return {
      profile: {
        user_id: data.userId,
        display_name: (prof?.display_name as string | undefined) ?? "Membre",
        bio: (prof?.bio as string | null | undefined) ?? null,
        avatar_url: (prof?.avatar_url as string | null | undefined) ?? null,
        member_since: (u.created_at as string | undefined) ?? null,
        email_verified: !!u.email_verified_at,
        active_offers_count: activeOffers ?? 0,
        rating_avg: ratingAvg,
        rating_count: ratingCount,
      },
      reviews: list.map((r) => ({
        id: r.id as string,
        rating: r.rating as number,
        comment: (r.comment as string | null) ?? null,
        created_at: r.created_at as string,
        reviewer_display_name: nameMap.get(r.reviewer_user_id as string) ?? "Membre",
      })),
    };
  });

// ---------- My review for a co-subscription (lightweight) ----------

export const getMyReviewForCoSub = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { coSubId: string }) =>
    z.object({ coSubId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: r } = await supabaseAdmin
      .from("reviews")
      .select("id,rating,comment,created_at")
      .eq("co_subscription_id", data.coSubId)
      .eq("reviewer_user_id", userId)
      .maybeSingle();
    return {
      review: r
        ? {
            id: r.id as string,
            rating: r.rating as number,
            comment: (r.comment as string | null) ?? null,
            created_at: r.created_at as string,
          }
        : null,
    };
  });

// ---------- Create review ----------

export const createReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        co_subscription_id: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        comment: z
          .string()
          .trim()
          .max(1000, "comment_too_long")
          .optional()
          .nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: cs } = await supabaseAdmin
      .from("co_subscriptions")
      .select("id,subscriber_user_id,owner_user_id,participation_status")
      .eq("id", data.co_subscription_id)
      .maybeSingle();
    if (!cs) throw new Error("not_found");
    if (cs.subscriber_user_id !== userId) throw new Error("forbidden");
    const status = cs.participation_status as string;
    if (!["active", "ended", "cancelled"].includes(status)) {
      throw new Error("review_not_allowed_yet");
    }

    const comment =
      data.comment === undefined || data.comment === null
        ? null
        : data.comment.trim() || null;

    const { error } = await supabaseAdmin.from("reviews").insert({
      co_subscription_id: data.co_subscription_id,
      reviewer_user_id: userId,
      reviewee_user_id: cs.owner_user_id,
      rating: data.rating,
      comment,
    });
    if (error) {
      if (error.code === "23505") throw new Error("review_already_exists");
      throw new Error(error.message || "review_create_failed");
    }
    return { ok: true };
  });
