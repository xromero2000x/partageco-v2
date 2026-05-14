export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          admin_role: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          admin_role?: Database["public"]["Enums"]["admin_role"]
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_type: string
          actor_user_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          action_type: string
          actor_type: string
          actor_user_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          action_type?: string
          actor_type?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      co_subscriptions: {
        Row: {
          accepted_at: string | null
          activated_at: string | null
          cancelled_at: string | null
          created_at: string
          ended_at: string | null
          id: string
          offer_id: string
          owner_user_id: string
          participation_status: Database["public"]["Enums"]["participation_status"]
          requested_at: string
          subscriber_user_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          offer_id: string
          owner_user_id: string
          participation_status?: Database["public"]["Enums"]["participation_status"]
          requested_at?: string
          subscriber_user_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          activated_at?: string | null
          cancelled_at?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          offer_id?: string
          owner_user_id?: string
          participation_status?: Database["public"]["Enums"]["participation_status"]
          requested_at?: string
          subscriber_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "co_subscriptions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "subscription_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_subscriptions_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "co_subscriptions_subscriber_user_id_fkey"
            columns: ["subscriber_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          left_at: string | null
          participant_role: Database["public"]["Enums"]["participant_role"]
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_role: Database["public"]["Enums"]["participant_role"]
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          participant_role?: Database["public"]["Enums"]["participant_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          co_subscription_id: string | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at: string
          id: string
          offer_id: string | null
          updated_at: string
        }
        Insert: {
          co_subscription_id?: string | null
          conversation_type: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          id?: string
          offer_id?: string | null
          updated_at?: string
        }
        Update: {
          co_subscription_id?: string | null
          conversation_type?: Database["public"]["Enums"]["conversation_type"]
          created_at?: string
          id?: string
          offer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_co_subscription_id_fkey"
            columns: ["co_subscription_id"]
            isOneToOne: false
            referencedRelation: "co_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "subscription_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      deletion_requests: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          processed_by_admin_user_id: string | null
          reason: string | null
          request_status: Database["public"]["Enums"]["deletion_request_status"]
          requested_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by_admin_user_id?: string | null
          reason?: string | null
          request_status?: Database["public"]["Enums"]["deletion_request_status"]
          requested_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          processed_by_admin_user_id?: string | null
          reason?: string | null
          request_status?: Database["public"]["Enums"]["deletion_request_status"]
          requested_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deletion_requests_processed_by_admin_user_id_fkey"
            columns: ["processed_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deletion_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          assigned_admin_user_id: string | null
          closed_at: string | null
          co_subscription_id: string
          created_at: string
          description: string | null
          dispute_reason: Database["public"]["Enums"]["dispute_reason"]
          dispute_status: Database["public"]["Enums"]["dispute_status"]
          id: string
          opened_by_user_id: string
          updated_at: string
        }
        Insert: {
          assigned_admin_user_id?: string | null
          closed_at?: string | null
          co_subscription_id: string
          created_at?: string
          description?: string | null
          dispute_reason: Database["public"]["Enums"]["dispute_reason"]
          dispute_status?: Database["public"]["Enums"]["dispute_status"]
          id?: string
          opened_by_user_id: string
          updated_at?: string
        }
        Update: {
          assigned_admin_user_id?: string | null
          closed_at?: string | null
          co_subscription_id?: string
          created_at?: string
          description?: string | null
          dispute_reason?: Database["public"]["Enums"]["dispute_reason"]
          dispute_status?: Database["public"]["Enums"]["dispute_status"]
          id?: string
          opened_by_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_assigned_admin_user_id_fkey"
            columns: ["assigned_admin_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_co_subscription_id_fkey"
            columns: ["co_subscription_id"]
            isOneToOne: false
            referencedRelation: "co_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_opened_by_user_id_fkey"
            columns: ["opened_by_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          message_status: Database["public"]["Enums"]["message_status"]
          sender_user_id: string
          updated_at: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"]
          sender_user_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          message_status?: Database["public"]["Enums"]["message_status"]
          sender_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at: string | null
          recipient_user_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          notification_type: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_user_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          notification_type?: Database["public"]["Enums"]["notification_type"]
          read_at?: string | null
          recipient_user_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_user_id_fkey"
            columns: ["recipient_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_records: {
        Row: {
          co_subscription_id: string
          created_at: string
          currency: string
          gross_amount: number
          id: string
          net_amount: number | null
          payee_user_id: string
          payer_user_id: string
          payment_status: Database["public"]["Enums"]["payment_status"]
          platform_fee_amount: number | null
          provider_name: string | null
          provider_reference: string | null
          updated_at: string
        }
        Insert: {
          co_subscription_id: string
          created_at?: string
          currency?: string
          gross_amount: number
          id?: string
          net_amount?: number | null
          payee_user_id: string
          payer_user_id: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee_amount?: number | null
          provider_name?: string | null
          provider_reference?: string | null
          updated_at?: string
        }
        Update: {
          co_subscription_id?: string
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number | null
          payee_user_id?: string
          payer_user_id?: string
          payment_status?: Database["public"]["Enums"]["payment_status"]
          platform_fee_amount?: number | null
          provider_name?: string | null
          provider_reference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_co_subscription_id_fkey"
            columns: ["co_subscription_id"]
            isOneToOne: false
            referencedRelation: "co_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_payee_user_id_fkey"
            columns: ["payee_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_payer_user_id_fkey"
            columns: ["payer_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          co_subscription_id: string
          comment: string | null
          created_at: string
          id: string
          is_published: boolean
          rating: number
          reviewee_user_id: string
          reviewer_user_id: string
          updated_at: string
        }
        Insert: {
          co_subscription_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating: number
          reviewee_user_id: string
          reviewer_user_id: string
          updated_at?: string
        }
        Update: {
          co_subscription_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          rating?: number
          reviewee_user_id?: string
          reviewer_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_categories: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_offers: {
        Row: {
          archived_at: string | null
          available_slots: number
          billing_period: string
          category_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          monthly_price_amount: number
          offer_status: Database["public"]["Enums"]["offer_status"]
          owner_user_id: string
          service_id: string
          service_plan_id: string | null
          title: string
          total_slots: number
          updated_at: string
          visibility: Database["public"]["Enums"]["offer_visibility"]
        }
        Insert: {
          archived_at?: string | null
          available_slots: number
          billing_period?: string
          category_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          monthly_price_amount: number
          offer_status?: Database["public"]["Enums"]["offer_status"]
          owner_user_id: string
          service_id: string
          service_plan_id?: string | null
          title: string
          total_slots: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["offer_visibility"]
        }
        Update: {
          archived_at?: string | null
          available_slots?: number
          billing_period?: string
          category_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          monthly_price_amount?: number
          offer_status?: Database["public"]["Enums"]["offer_status"]
          owner_user_id?: string
          service_id?: string
          service_plan_id?: string | null
          title?: string
          total_slots?: number
          updated_at?: string
          visibility?: Database["public"]["Enums"]["offer_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "subscription_offers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "subscription_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_offers_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_offers_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "subscription_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_offers_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_service_plans: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          service_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          service_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          service_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_service_plans_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "subscription_services"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_services: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "subscription_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          deleted_at: string | null
          email: string
          email_verified_at: string | null
          id: string
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          deleted_at?: string | null
          email: string
          email_verified_at?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          deleted_at?: string | null
          email?: string
          email_verified_at?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_participation: {
        Args: { p_co_sub_id: string; p_owner_user_id: string }
        Returns: Json
      }
      has_admin_role: {
        Args: {
          _role: Database["public"]["Enums"]["admin_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_offer_available_slots: {
        Args: { p_offer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      account_status:
        | "pending_verification"
        | "active"
        | "suspended"
        | "deletion_requested"
      admin_role: "super_admin" | "support_admin" | "moderation_admin"
      conversation_type: "participation_context" | "dispute_context"
      deletion_request_status:
        | "requested"
        | "under_review"
        | "rejected"
        | "completed"
      dispute_reason:
        | "access_issue"
        | "payment_issue"
        | "communication_issue"
        | "offer_mismatch"
        | "other"
      dispute_status:
        | "open"
        | "under_review"
        | "waiting_user_response"
        | "resolved"
        | "closed"
      message_status: "sent" | "deleted_by_user" | "hidden_by_admin"
      notification_type:
        | "email_verification"
        | "participation_request"
        | "participation_status_changed"
        | "message_received"
        | "dispute_updated"
        | "admin_action"
      offer_status:
        | "draft"
        | "pending_review"
        | "active"
        | "paused"
        | "rejected"
        | "archived"
      offer_visibility: "private" | "public" | "admin_only"
      participant_role: "owner" | "subscriber" | "admin"
      participation_status:
        | "requested"
        | "accepted_pending_payment"
        | "active"
        | "rejected"
        | "cancelled"
        | "expired"
      payment_status: "pending" | "simulated" | "failed" | "cancelled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: [
        "pending_verification",
        "active",
        "suspended",
        "deletion_requested",
      ],
      admin_role: ["super_admin", "support_admin", "moderation_admin"],
      conversation_type: ["participation_context", "dispute_context"],
      deletion_request_status: [
        "requested",
        "under_review",
        "rejected",
        "completed",
      ],
      dispute_reason: [
        "access_issue",
        "payment_issue",
        "communication_issue",
        "offer_mismatch",
        "other",
      ],
      dispute_status: [
        "open",
        "under_review",
        "waiting_user_response",
        "resolved",
        "closed",
      ],
      message_status: ["sent", "deleted_by_user", "hidden_by_admin"],
      notification_type: [
        "email_verification",
        "participation_request",
        "participation_status_changed",
        "message_received",
        "dispute_updated",
        "admin_action",
      ],
      offer_status: [
        "draft",
        "pending_review",
        "active",
        "paused",
        "rejected",
        "archived",
      ],
      offer_visibility: ["private", "public", "admin_only"],
      participant_role: ["owner", "subscriber", "admin"],
      participation_status: [
        "requested",
        "accepted_pending_payment",
        "active",
        "rejected",
        "cancelled",
        "expired",
      ],
      payment_status: ["pending", "simulated", "failed", "cancelled"],
    },
  },
} as const
