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
      app_settings: {
        Row: {
          id: boolean
          membership_term_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          membership_term_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          membership_term_ends_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_sessions: {
        Row: {
          created_at: string | null
          end_time: string | null
          event_id: string
          id: string
          name: string
          start_time: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          name: string
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_time?: string | null
          event_id?: string
          id?: string
          name?: string
          start_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          check_in_session_id: string
          checked_in_at: string | null
          created_at: string | null
          event_registration_id: string
          id: string
          updated_at: string | null
        }
        Insert: {
          check_in_session_id: string
          checked_in_at?: string | null
          created_at?: string | null
          event_registration_id: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          check_in_session_id?: string
          checked_in_at?: string | null
          created_at?: string | null
          event_registration_id?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_check_in_session_id_fkey"
            columns: ["check_in_session_id"]
            isOneToOne: false
            referencedRelation: "check_in_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_application_questions: {
        Row: {
          allowed_file_types: string[] | null
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          is_required: boolean
          max_char_limit: number | null
          max_file_size_bytes: number | null
          question: string
          response_options: string[] | null
          response_type: Database["public"]["Enums"]["response_type"]
          restrict_file_types: boolean
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          allowed_file_types?: string[] | null
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          is_required?: boolean
          max_char_limit?: number | null
          max_file_size_bytes?: number | null
          question: string
          response_options?: string[] | null
          response_type: Database["public"]["Enums"]["response_type"]
          restrict_file_types?: boolean
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          allowed_file_types?: string[] | null
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          is_required?: boolean
          max_char_limit?: number | null
          max_file_size_bytes?: number | null
          question?: string
          response_options?: string[] | null
          response_type?: Database["public"]["Enums"]["response_type"]
          restrict_file_types?: boolean
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_application_questions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_application_responses: {
        Row: {
          created_at: string | null
          event_application_question_id: string
          event_registration_id: string
          id: string
          response: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_application_question_id: string
          event_registration_id: string
          id?: string
          response?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_application_question_id?: string
          event_registration_id?: string
          id?: string
          response?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_application_responses_event_application_question_id_fkey"
            columns: ["event_application_question_id"]
            isOneToOne: false
            referencedRelation: "event_application_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_application_responses_event_registration_id_fkey"
            columns: ["event_registration_id"]
            isOneToOne: false
            referencedRelation: "event_registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_mentors: {
        Row: {
          event_id: string
          mentor_id: string
          sort_order: number
        }
        Insert: {
          event_id: string
          mentor_id: string
          sort_order?: number
        }
        Update: {
          event_id?: string
          mentor_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_mentors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_mentors_mentor_id_fkey"
            columns: ["mentor_id"]
            isOneToOne: false
            referencedRelation: "mentors"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          attending: boolean | null
          created_at: string | null
          event_id: string
          id: string
          purchase_id: string | null
          reviewer_id: string | null
          status: Database["public"]["Enums"]["application_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          attending?: boolean | null
          created_at?: string | null
          event_id: string
          id?: string
          purchase_id?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          attending?: boolean | null
          created_at?: string | null
          event_id?: string
          id?: string
          purchase_id?: string | null
          reviewer_id?: string | null
          status?: Database["public"]["Enums"]["application_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sponsors: {
        Row: {
          event_id: string
          sort_order: number
          sponsor_id: string
        }
        Insert: {
          event_id: string
          sort_order?: number
          sponsor_id: string
        }
        Update: {
          event_id?: string
          sort_order?: number
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sponsors_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsors_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: Json | null
          applications_enabled: boolean
          created_at: string | null
          description: string
          description_images: string[] | null
          end_date: string | null
          end_time: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          image_url: string | null
          location_address_url: string | null
          location_building: string | null
          location_room: string | null
          max_capacity: number
          member_price: number
          mentors_enabled: boolean
          name: string
          registration_end_time: string | null
          registration_start_time: string | null
          regular_price: number
          short_description: string | null
          slug: string
          sponsors_enabled: boolean
          start_date: string | null
          start_time: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string | null
        }
        Insert: {
          agenda?: Json | null
          applications_enabled?: boolean
          created_at?: string | null
          description: string
          description_images?: string[] | null
          end_date?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          image_url?: string | null
          location_address_url?: string | null
          location_building?: string | null
          location_room?: string | null
          max_capacity: number
          member_price?: number
          mentors_enabled?: boolean
          name: string
          registration_end_time?: string | null
          registration_start_time?: string | null
          regular_price: number
          short_description?: string | null
          slug: string
          sponsors_enabled?: boolean
          start_date?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
        }
        Update: {
          agenda?: Json | null
          applications_enabled?: boolean
          created_at?: string | null
          description?: string
          description_images?: string[] | null
          end_date?: string | null
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          image_url?: string | null
          location_address_url?: string | null
          location_building?: string | null
          location_room?: string | null
          max_capacity?: number
          member_price?: number
          mentors_enabled?: boolean
          name?: string
          registration_end_time?: string | null
          registration_start_time?: string | null
          regular_price?: number
          short_description?: string | null
          slug?: string
          sponsors_enabled?: boolean
          start_date?: string | null
          start_time?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string | null
        }
        Relationships: []
      }
      membership_types: {
        Row: {
          created_at: string | null
          description: string
          eligible_user_types: Database["public"]["Enums"]["user_type"][]
          features: string[] | null
          id: string
          name: string
          price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          eligible_user_types?: Database["public"]["Enums"]["user_type"][]
          features?: string[] | null
          id?: string
          name: string
          price: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          eligible_user_types?: Database["public"]["Enums"]["user_type"][]
          features?: string[] | null
          id?: string
          name?: string
          price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mentors: {
        Row: {
          created_at: string
          description: string | null
          full_name: string
          id: string
          linkedin_url: string | null
          position: string | null
          profile_image_path: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          position?: string | null
          profile_image_path?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          full_name?: string
          id?: string
          linkedin_url?: string | null
          position?: string | null
          profile_image_path?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          confirmation_email_attempted_at: string | null
          confirmation_email_sent_at: string | null
          created_at: string | null
          currency: string
          event_id: string | null
          failure_reason: string | null
          fulfilled_at: string | null
          id: string
          idempotency_key: string
          kind: string
          membership_type_id: string | null
          square_customer_id: string | null
          square_payment_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_cents: number
          confirmation_email_attempted_at?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          currency: string
          event_id?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          idempotency_key: string
          kind: string
          membership_type_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          confirmation_email_attempted_at?: string | null
          confirmation_email_sent_at?: string | null
          created_at?: string | null
          currency?: string
          event_id?: string | null
          failure_reason?: string | null
          fulfilled_at?: string | null
          id?: string
          idempotency_key?: string
          kind?: string
          membership_type_id?: string | null
          square_customer_id?: string | null
          square_payment_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_membership_type_id_fkey"
            columns: ["membership_type_id"]
            isOneToOne: false
            referencedRelation: "membership_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          brand_logo_path: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          brand_logo_path?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          brand_logo_path?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      square_webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          payload: Json
          processed_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          payload: Json
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          payload?: Json
          processed_at?: string | null
        }
        Relationships: []
      }
      user_info: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          deleted_at: string | null
          dietary_restrictions: string | null
          email: string
          faculty: string | null
          faculty_email: string | null
          first_name: string
          id: string
          last_name: string
          major: string | null
          membership_expires_at: string | null
          membership_pre_ordered_type_id: string | null
          membership_type_id: string | null
          newsletter: boolean
          order_date_deprecated: string | null
          phone: string | null
          preferred_pronouns: string | null
          role_access: Database["public"]["Enums"]["role_access_enum"]
          school_institution: string | null
          square_customer_id: string | null
          student_number: number | null
          student_status: Database["public"]["Enums"]["student_status"] | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
          year: Database["public"]["Enums"]["uni_year"] | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dietary_restrictions?: string | null
          email: string
          faculty?: string | null
          faculty_email?: string | null
          first_name: string
          id?: string
          last_name: string
          major?: string | null
          membership_expires_at?: string | null
          membership_pre_ordered_type_id?: string | null
          membership_type_id?: string | null
          newsletter?: boolean
          order_date_deprecated?: string | null
          phone?: string | null
          preferred_pronouns?: string | null
          role_access: Database["public"]["Enums"]["role_access_enum"]
          school_institution?: string | null
          square_customer_id?: string | null
          student_number?: number | null
          student_status?: Database["public"]["Enums"]["student_status"] | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          year?: Database["public"]["Enums"]["uni_year"] | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dietary_restrictions?: string | null
          email?: string
          faculty?: string | null
          faculty_email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          major?: string | null
          membership_expires_at?: string | null
          membership_pre_ordered_type_id?: string | null
          membership_type_id?: string | null
          newsletter?: boolean
          order_date_deprecated?: string | null
          phone?: string | null
          preferred_pronouns?: string | null
          role_access?: Database["public"]["Enums"]["role_access_enum"]
          school_institution?: string | null
          square_customer_id?: string | null
          student_number?: number | null
          student_status?: Database["public"]["Enums"]["student_status"] | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          year?: Database["public"]["Enums"]["uni_year"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_info_membership_pre_ordered_type_id_fkey"
            columns: ["membership_pre_ordered_type_id"]
            isOneToOne: false
            referencedRelation: "membership_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_info_old_membership_type_id_fkey"
            columns: ["membership_type_id"]
            isOneToOne: false
            referencedRelation: "membership_types"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_info_id: { Args: never; Returns: string }
      delete_account: { Args: { p_auth_user_id: string }; Returns: undefined }
      delete_event_atomically: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      get_user_info_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_authenticated: { Args: never; Returns: boolean }
      release_paid_event_ticket_reservation: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      reserve_paid_event_ticket: {
        Args: { p_event_id: string; p_purchase_id: string; p_user_id: string }
        Returns: {
          failure_reason: string
          registration_id: string
        }[]
      }
      save_admin_event_atomically: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_event: Json
          p_event_id: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
    }
    Enums: {
      application_status: "pending" | "declined" | "accepted"
      event_status: "draft" | "active" | "archived"
      event_type: "regular" | "flagship"
      response_type:
        | "short_text"
        | "long_text"
        | "checkbox"
        | "multiple_choice"
        | "dropdown"
        | "file_upload"
      role_access_enum: "basic" | "admin"
      student_status: "undergraduate" | "graduate" | "other"
      uni_year: "1" | "2" | "3" | "4" | "5+"
      user_type: "ubcStudent" | "faculty" | "nonUbc"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      application_status: ["pending", "declined", "accepted"],
      event_status: ["draft", "active", "archived"],
      event_type: ["regular", "flagship"],
      response_type: [
        "short_text",
        "long_text",
        "checkbox",
        "multiple_choice",
        "dropdown",
        "file_upload",
      ],
      role_access_enum: ["basic", "admin"],
      student_status: ["undergraduate", "graduate", "other"],
      uni_year: ["1", "2", "3", "4", "5+"],
      user_type: ["ubcStudent", "faculty", "nonUbc"],
    },
  },
} as const
