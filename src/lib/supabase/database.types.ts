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
      admin_event_drafts: {
        Row: {
          document: NonNullable<Json>
          event_id: string | null
          event_revision: number | null
          id: string
          materialized: boolean
          materialized_result: Json | null
          revision: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          document: NonNullable<Json>
          event_id?: string | null
          event_revision?: number | null
          id: string
          materialized?: boolean
          materialized_result?: Json | null
          revision?: number
          updated_at?: string
        }
        Update: {
          document?: NonNullable<Json>
          event_id?: string | null
          event_revision?: number | null
          id?: string
          materialized?: boolean
          materialized_result?: Json | null
          revision?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_drafts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_event_mutations: {
        Row: {
          created_at: string
          id: string
          request: NonNullable<Json>
          result: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id: string
          request: NonNullable<Json>
          result: NonNullable<Json>
        }
        Update: {
          created_at?: string
          id?: string
          request?: NonNullable<Json>
          result?: NonNullable<Json>
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: boolean
          membership_term_ends_at: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
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
      application_review_notes: {
        Row: {
          application_id: string
          author_id: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
        }
        ComputedFields: never
        Insert: {
          application_id: string
          author_id?: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Update: {
          application_id?: string
          author_id?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_review_notes_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "event_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "application_review_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          changes: Json | null
          context: NonNullable<Json>
          created_at: string
          id: string
          source: Database["public"]["Enums"]["audit_event_source"]
          subject_id: string | null
          subject_table: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          changes?: Json | null
          context?: NonNullable<Json>
          created_at?: string
          id?: string
          source: Database["public"]["Enums"]["audit_event_source"]
          subject_id?: string | null
          subject_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          changes?: Json | null
          context?: NonNullable<Json>
          created_at?: string
          id?: string
          source?: Database["public"]["Enums"]["audit_event_source"]
          subject_id?: string | null
          subject_table?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_activity: {
        Row: {
          attendance_version: string
          checked_in_at: string
          event_id: string
          item_id: string
          method: string
          operator_id: string | null
          ticket_id: string
          undone_at: string | null
        }
        ComputedFields: never
        Insert: {
          attendance_version: string
          checked_in_at: string
          event_id: string
          item_id: string
          method: string
          operator_id?: string | null
          ticket_id: string
          undone_at?: string | null
        }
        Update: {
          attendance_version?: string
          checked_in_at?: string
          event_id?: string
          item_id?: string
          method?: string
          operator_id?: string | null
          ticket_id?: string
          undone_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_in_activity_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_activity_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "event_agenda_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_activity_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_in_activity_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "event_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      check_in_sessions: {
        Row: {
          agenda_item_id: string | null
          created_at: string | null
          end_time: string | null
          event_id: string
          id: string
          name: string
          start_time: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          agenda_item_id?: string | null
          created_at?: string | null
          end_time?: string | null
          event_id: string
          id?: string
          name: string
          start_time?: string | null
          updated_at?: string | null
        }
        Update: {
          agenda_item_id?: string | null
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
            foreignKeyName: "check_in_sessions_agenda_item_id_fkey"
            columns: ["agenda_item_id"]
            isOneToOne: true
            referencedRelation: "event_agenda_items"
            referencedColumns: ["id"]
          },
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
          attendance_version: string
          check_in_session_id: string
          checked_in_at: string | null
          created_at: string | null
          id: string
          ticket_id: string
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          attendance_version?: string
          check_in_session_id: string
          checked_in_at?: string | null
          created_at?: string | null
          id?: string
          ticket_id: string
          updated_at?: string | null
        }
        Update: {
          attendance_version?: string
          check_in_session_id?: string
          checked_in_at?: string | null
          created_at?: string | null
          id?: string
          ticket_id?: string
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
            foreignKeyName: "check_ins_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "event_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agenda_days: {
        Row: {
          date: string
          ends_at: string | null
          event_id: string
          id: string
          starts_at: string | null
          title: string | null
        }
        ComputedFields: never
        Insert: {
          date: string
          ends_at?: string | null
          event_id: string
          id?: string
          starts_at?: string | null
          title?: string | null
        }
        Update: {
          date?: string
          ends_at?: string | null
          event_id?: string
          id?: string
          starts_at?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_agenda_days_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agenda_items: {
        Row: {
          building: string | null
          check_in: boolean
          description: string
          end_time: string
          ends_at: string | null
          event_agenda_day_id: string
          id: string
          room: string | null
          start_time: string
          starts_at: string | null
          title: string
        }
        ComputedFields: never
        Insert: {
          building?: string | null
          check_in?: boolean
          description?: string
          end_time: string
          ends_at?: string | null
          event_agenda_day_id: string
          id?: string
          room?: string | null
          start_time: string
          starts_at?: string | null
          title: string
        }
        Update: {
          building?: string | null
          check_in?: boolean
          description?: string
          end_time?: string
          ends_at?: string | null
          event_agenda_day_id?: string
          id?: string
          room?: string | null
          start_time?: string
          starts_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_agenda_items_event_agenda_day_id_fkey"
            columns: ["event_agenda_day_id"]
            isOneToOne: false
            referencedRelation: "event_agenda_days"
            referencedColumns: ["id"]
          },
        ]
      }
      event_agenda_notes: {
        Row: {
          body: string
          item_id: string
          revision: number
        }
        ComputedFields: never
        Insert: {
          body?: string
          item_id: string
          revision?: number
        }
        Update: {
          body?: string
          item_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_agenda_notes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "event_agenda_items"
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
        ComputedFields: never
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
          application_id: string
          created_at: string | null
          event_application_question_id: string
          id: string
          response: string | null
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          application_id: string
          created_at?: string | null
          event_application_question_id: string
          id?: string
          response?: string | null
          updated_at?: string | null
        }
        Update: {
          application_id?: string
          created_at?: string | null
          event_application_question_id?: string
          id?: string
          response?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_application_responses_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "event_applications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_application_responses_event_application_question_id_fkey"
            columns: ["event_application_question_id"]
            isOneToOne: false
            referencedRelation: "event_application_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      event_application_settings: {
        Row: {
          confirmation_deadline: string | null
          decisions_release_at: string | null
          event_id: string
          questions_locked_at: string | null
        }
        ComputedFields: never
        Insert: {
          confirmation_deadline?: string | null
          decisions_release_at?: string | null
          event_id: string
          questions_locked_at?: string | null
        }
        Update: {
          confirmation_deadline?: string | null
          decisions_release_at?: string | null
          event_id?: string
          questions_locked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_application_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_applications: {
        Row: {
          created_at: string
          event_id: string
          id: string
          offer_expires_at: string | null
          status: Database["public"]["Enums"]["event_application_status"]
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          offer_expires_at?: string | null
          status?: Database["public"]["Enums"]["event_application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          offer_expires_at?: string | null
          status?: Database["public"]["Enums"]["event_application_status"]
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      event_content_settings: {
        Row: {
          document: NonNullable<Json>
          event_id: string
          revision: number
        }
        ComputedFields: never
        Insert: {
          document: NonNullable<Json>
          event_id: string
          revision?: number
        }
        Update: {
          document?: NonNullable<Json>
          event_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_content_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_date_location_settings: {
        Row: {
          document: NonNullable<Json>
          event_id: string
          revision: number
        }
        ComputedFields: never
        Insert: {
          document: NonNullable<Json>
          event_id: string
          revision?: number
        }
        Update: {
          document?: NonNullable<Json>
          event_id?: string
          revision?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_date_location_settings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_links: {
        Row: {
          created_at: string
          event_id: string
          id: string
          label: string | null
          sort_order: number
          type: Database["public"]["Enums"]["event_link_type"]
          updated_at: string
          url: string
          visibility: Database["public"]["Enums"]["event_link_visibility"]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          label?: string | null
          sort_order?: number
          type: Database["public"]["Enums"]["event_link_type"]
          updated_at?: string
          url: string
          visibility?: Database["public"]["Enums"]["event_link_visibility"]
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          label?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["event_link_type"]
          updated_at?: string
          url?: string
          visibility?: Database["public"]["Enums"]["event_link_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "event_links_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_mentors: {
        Row: {
          event_id: string
          mentor_id: string
          section_id: string
          sort_order: number
        }
        ComputedFields: never
        Insert: {
          event_id: string
          mentor_id: string
          section_id: string
          sort_order?: number
        }
        Update: {
          event_id?: string
          mentor_id?: string
          section_id?: string
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
          {
            foreignKeyName: "event_mentors_section_id_fkey"
            columns: ["event_id", "section_id"]
            isOneToOne: false
            referencedRelation: "event_people_sections"
            referencedColumns: ["event_id", "id"]
          },
        ]
      }
      event_people_sections: {
        Row: {
          created_at: string
          event_id: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_people_sections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_private_details: {
        Row: {
          created_at: string
          event_id: string
          meeting_id: string | null
          meeting_passcode: string | null
          meeting_url: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          meeting_id?: string | null
          meeting_passcode?: string | null
          meeting_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          meeting_id?: string | null
          meeting_passcode?: string | null
          meeting_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_private_details_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
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
        ComputedFields: never
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
      event_staff_volunteer_schedules: {
        Row: {
          event_id: string
          id: string
          label: string
          sort_order: number
          url: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          id?: string
          label?: string
          sort_order?: number
          url: string
        }
        Update: {
          event_id?: string
          id?: string
          label?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_staff_volunteer_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          created_at: string
          event_id: string
          id: string
          purchase_id: string | null
          qr_token: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          purchase_id?: string | null
          qr_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          purchase_id?: string | null
          qr_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tickets_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tickets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      event_url_claims: {
        Row: {
          event_id: string
          slug: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          slug: string
        }
        Update: {
          event_id?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_url_claims_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          agenda: Json | null
          agenda_enabled: boolean
          canceled_at: string | null
          cancellation_note: string | null
          configured_marketing_mode: string | null
          configured_marketing_url: string | null
          configured_price: number | null
          configured_pricing_mode: string | null
          configured_slug: string | null
          configured_slug_edited: boolean
          created_at: string | null
          description: string | null
          description_images: string[] | null
          description_rich: Json | null
          ends_at: string | null
          event_colour: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          first_published_at: string | null
          header_colour: string | null
          header_image_url: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          legacy_draft_ids: string[]
          location_address: string | null
          location_address_url: string | null
          location_building: string | null
          location_room: string | null
          location_type: Database["public"]["Enums"]["event_location_type"]
          marketing_url: string | null
          max_capacity: number | null
          max_team_size: number | null
          member_price: number | null
          mentors_enabled: boolean
          min_team_size: number | null
          name: string
          pricing_policy: string
          publish_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          regular_price: number | null
          requires_application: boolean
          revision: number
          short_description: string | null
          slug: string
          sponsors_enabled: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          team_deadline: string | null
          teams_enabled: boolean
          updated_at: string | null
          working_document: Json | null
          working_revision: number
          event_has_ended: boolean | null
        }
        ComputedFields: "event_has_ended"
        Insert: {
          agenda?: Json | null
          agenda_enabled?: boolean
          canceled_at?: string | null
          cancellation_note?: string | null
          configured_marketing_mode?: string | null
          configured_marketing_url?: string | null
          configured_price?: number | null
          configured_pricing_mode?: string | null
          configured_slug?: string | null
          configured_slug_edited?: boolean
          created_at?: string | null
          description?: string | null
          description_images?: string[] | null
          description_rich?: Json | null
          ends_at?: string | null
          event_colour?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          first_published_at?: string | null
          header_colour?: string | null
          header_image_url?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          legacy_draft_ids?: string[]
          location_address?: string | null
          location_address_url?: string | null
          location_building?: string | null
          location_room?: string | null
          location_type?: Database["public"]["Enums"]["event_location_type"]
          marketing_url?: string | null
          max_capacity?: number | null
          max_team_size?: number | null
          member_price?: number | null
          mentors_enabled?: boolean
          min_team_size?: number | null
          name: string
          pricing_policy?: string
          publish_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          regular_price?: number | null
          requires_application?: boolean
          revision?: number
          short_description?: string | null
          slug: string
          sponsors_enabled?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          team_deadline?: string | null
          teams_enabled?: boolean
          updated_at?: string | null
          working_document?: Json | null
          working_revision?: number
        }
        Update: {
          agenda?: Json | null
          agenda_enabled?: boolean
          canceled_at?: string | null
          cancellation_note?: string | null
          configured_marketing_mode?: string | null
          configured_marketing_url?: string | null
          configured_price?: number | null
          configured_pricing_mode?: string | null
          configured_slug?: string | null
          configured_slug_edited?: boolean
          created_at?: string | null
          description?: string | null
          description_images?: string[] | null
          description_rich?: Json | null
          ends_at?: string | null
          event_colour?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          first_published_at?: string | null
          header_colour?: string | null
          header_image_url?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean
          legacy_draft_ids?: string[]
          location_address?: string | null
          location_address_url?: string | null
          location_building?: string | null
          location_room?: string | null
          location_type?: Database["public"]["Enums"]["event_location_type"]
          marketing_url?: string | null
          max_capacity?: number | null
          max_team_size?: number | null
          member_price?: number | null
          mentors_enabled?: boolean
          min_team_size?: number | null
          name?: string
          pricing_policy?: string
          publish_at?: string | null
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          regular_price?: number | null
          requires_application?: boolean
          revision?: number
          short_description?: string | null
          slug?: string
          sponsors_enabled?: boolean
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          team_deadline?: string | null
          teams_enabled?: boolean
          updated_at?: string | null
          working_document?: Json | null
          working_revision?: number
        }
        Relationships: []
      }
      membership_types: {
        Row: {
          active: boolean
          created_at: string | null
          description: string
          eligible_user_types: Database["public"]["Enums"]["user_type"][]
          id: string
          name: string
          price: number
          slug: string
          updated_at: string | null
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          created_at?: string | null
          description: string
          eligible_user_types?: Database["public"]["Enums"]["user_type"][]
          id?: string
          name: string
          price: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string
          eligible_user_types?: Database["public"]["Enums"]["user_type"][]
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
          owner_event_id: string | null
          position: string | null
          profile_image_path: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          full_name: string
          id?: string
          linkedin_url?: string | null
          owner_event_id?: string | null
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
          owner_event_id?: string | null
          position?: string | null
          profile_image_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentors_owner_event_id_fkey"
            columns: ["owner_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
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
          refunded_at: string | null
          refunded_cents: number
          square_customer_id: string | null
          square_payment_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        ComputedFields: never
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
          refunded_at?: string | null
          refunded_cents?: number
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
          refunded_at?: string | null
          refunded_cents?: number
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
          description: string | null
          id: string
          name: string
          owner_event_id: string | null
          updated_at: string
          website_url: string | null
        }
        ComputedFields: never
        Insert: {
          brand_logo_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          owner_event_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          brand_logo_path?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          owner_event_id?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_owner_event_id_fkey"
            columns: ["owner_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      square_webhook_events: {
        Row: {
          created_at: string | null
          event_id: string
          event_type: string
          payload: NonNullable<Json>
          processed_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string | null
          event_id: string
          event_type: string
          payload: NonNullable<Json>
          processed_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_type?: string
          payload?: NonNullable<Json>
          processed_at?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          event_id: string
          joined_at: string
          team_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          event_id: string
          joined_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          event_id?: string
          joined_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_event_id_fkey"
            columns: ["team_id", "event_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "event_id"]
          },
          {
            foreignKeyName: "team_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invite_code: string
          name: string | null
          owner_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invite_code?: string
          name?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invite_code?: string
          name?: string | null
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
      user_info: {
        Row: {
          allergies: string[]
          auth_user_id: string | null
          avatar_preset: string | null
          birth_date: string | null
          created_at: string | null
          deleted_at: string | null
          dietary_restrictions: string | null
          diets: string[]
          email: string
          faculty: string | null
          faculty_email: string | null
          first_name: string
          id: string
          interests: string[]
          last_name: string
          major: string | null
          membership_expires_at: string | null
          membership_pre_ordered_type_id: string | null
          membership_type_id: string | null
          newsletter: boolean
          order_date_deprecated: string | null
          other_allergies: string[]
          phone: string | null
          preferred_pronouns: string | null
          profile_photo_path: string | null
          role_access: Database["public"]["Enums"]["role_access_enum"]
          school_institution: string | null
          setup_step: string
          square_customer_id: string | null
          student_number: number | null
          student_status: Database["public"]["Enums"]["student_status"] | null
          student_verified_at: string | null
          student_verified_by: string | null
          updated_at: string | null
          user_type: Database["public"]["Enums"]["user_type"]
          user_type_confirmed_at: string | null
          year: Database["public"]["Enums"]["uni_year"] | null
        }
        ComputedFields: never
        Insert: {
          allergies?: string[]
          auth_user_id?: string | null
          avatar_preset?: string | null
          birth_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dietary_restrictions?: string | null
          diets?: string[]
          email: string
          faculty?: string | null
          faculty_email?: string | null
          first_name: string
          id?: string
          interests?: string[]
          last_name: string
          major?: string | null
          membership_expires_at?: string | null
          membership_pre_ordered_type_id?: string | null
          membership_type_id?: string | null
          newsletter?: boolean
          order_date_deprecated?: string | null
          other_allergies?: string[]
          phone?: string | null
          preferred_pronouns?: string | null
          profile_photo_path?: string | null
          role_access: Database["public"]["Enums"]["role_access_enum"]
          school_institution?: string | null
          setup_step?: string
          square_customer_id?: string | null
          student_number?: number | null
          student_status?: Database["public"]["Enums"]["student_status"] | null
          student_verified_at?: string | null
          student_verified_by?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          user_type_confirmed_at?: string | null
          year?: Database["public"]["Enums"]["uni_year"] | null
        }
        Update: {
          allergies?: string[]
          auth_user_id?: string | null
          avatar_preset?: string | null
          birth_date?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dietary_restrictions?: string | null
          diets?: string[]
          email?: string
          faculty?: string | null
          faculty_email?: string | null
          first_name?: string
          id?: string
          interests?: string[]
          last_name?: string
          major?: string | null
          membership_expires_at?: string | null
          membership_pre_ordered_type_id?: string | null
          membership_type_id?: string | null
          newsletter?: boolean
          order_date_deprecated?: string | null
          other_allergies?: string[]
          phone?: string | null
          preferred_pronouns?: string | null
          profile_photo_path?: string | null
          role_access?: Database["public"]["Enums"]["role_access_enum"]
          school_institution?: string | null
          setup_step?: string
          square_customer_id?: string | null
          student_number?: number | null
          student_status?: Database["public"]["Enums"]["student_status"] | null
          student_verified_at?: string | null
          student_verified_by?: string | null
          updated_at?: string | null
          user_type?: Database["public"]["Enums"]["user_type"]
          user_type_confirmed_at?: string | null
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
          {
            foreignKeyName: "user_info_student_verified_by_fkey"
            columns: ["student_verified_by"]
            isOneToOne: false
            referencedRelation: "user_info"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_event_pricing_locked: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      admin_event_team_settings: { Args: { p_event_id: string }; Returns: Json }
      agenda_draft_instant: {
        Args: { p_date: string; p_time: string }
        Returns: string
      }
      agenda_pacific_instant: {
        Args: { p_date: string; p_time: string }
        Returns: string
      }
      application_decisions_released: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      apply_event_purchase_refund: {
        Args: { p_purchase_id: string; p_refunded_cents: number }
        Returns: {
          amount_increased: boolean
          fully_refunded: boolean
          kept_checked_in_ticket: boolean
          refunded_total_cents: number
          ticket_removed: boolean
        }[]
      }
      audit_ignored_columns: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      can_edit_application_response: {
        Args: { p_application_id: string; p_question_id: string }
        Returns: boolean
      }
      can_read_application_file: { Args: { p_name: string }; Returns: boolean }
      can_remove_application_file: {
        Args: { p_name: string }
        Returns: boolean
      }
      can_upload_application_file: {
        Args: { p_name: string }
        Returns: boolean
      }
      cancel_admin_event: {
        Args: { p_event_id: string; p_note: string; p_operation_id: string }
        Returns: Json
      }
      claim_application_emails: {
        Args: { p_event_ids?: string[]; p_limit?: number }
        Returns: {
          application_id: string
          attempts: number
          delivery_id: string
          email: string
          ends_at: string
          event_id: string
          event_name: string
          event_slug: string
          first_name: string
          kind: string
          offer_expires_at: string
          starts_at: string
        }[]
      }
      complete_application_email: {
        Args: { p_delivery_id: string; p_error_code?: string; p_sent: boolean }
        Returns: number
      }
      create_staff_volunteer_schedule: {
        Args: { p_event_id: string; p_operation_id: string; p_url: string }
        Returns: Json
      }
      create_team: {
        Args: { p_event_id: string; p_name?: string; p_user_id: string }
        Returns: {
          failure_reason: string
          team_id: string
        }[]
      }
      current_user_info_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_user_team_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
      decide_event_application: {
        Args: {
          p_allow_over_capacity?: boolean
          p_application_id: string
          p_decision: string
          p_offer_expires_at?: string
        }
        Returns: {
          application_id: string
          decisions_release_at: string
          event_id: string
          failure_reason: string
          held_offers: number
          max_capacity: number
          offer_expires_at: string
          over_capacity: boolean
          previous_status: Database["public"]["Enums"]["event_application_status"]
          status: Database["public"]["Enums"]["event_application_status"]
          tickets: number
          user_id: string
        }[]
      }
      delete_account: { Args: { p_auth_user_id: string }; Returns: undefined }
      delete_admin_event_safely: {
        Args: { p_event_id: string; p_operation_id: string }
        Returns: Json
      }
      delete_event_atomically: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      delete_event_before_safe_mutations: {
        Args: { target_event_id: string }
        Returns: undefined
      }
      delete_team: {
        Args: { p_team_id: string; p_user_id: string }
        Returns: string
      }
      draft_event_integer: {
        Args: { minimum?: number; value: string }
        Returns: number
      }
      draft_event_number: { Args: { value: string }; Returns: number }
      draft_event_timestamp: { Args: { value: string }; Returns: string }
      draft_event_wall_time: { Args: { value: string }; Returns: string }
      event_checkout_amount: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: number
      }
      event_has_ended: {
        Args: {
          e: Omit<
            Database["public"]["Tables"]["events"]["Row"],
            Database["public"]["Tables"]["events"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      event_has_live_purchases: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      event_is_public: {
        Args: {
          p_publish_at: string
          p_status: Database["public"]["Enums"]["event_status"]
        }
        Returns: boolean
      }
      event_lifecycle_counts: {
        Args: { p_event_id: string }
        Returns: {
          member_applications: number
          paid_tickets: number
          registered: number
        }[]
      }
      event_member_commitments: {
        Args: { p_event_id: string }
        Returns: {
          offers: number
          pending_purchases: number
          tickets: number
        }[]
      }
      event_participant_content: { Args: { p_event_id: string }; Returns: Json }
      event_publication_health: {
        Args: { p_before: string }
        Returns: {
          blocked_count: number
          blocked_event_ids: string[]
          overdue_count: number
        }[]
      }
      event_seat_counts: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          held_offers: number
          seats_left: number
          tickets: number
        }[]
      }
      event_seat_counts_unfiltered: {
        Args: { p_event_ids: string[] }
        Returns: {
          event_id: string
          held_offers: number
          seats_left: number
          tickets: number
        }[]
      }
      event_ticket_eligibility: {
        Args: { p_amount_cents?: number; p_event_id: string; p_user_id: string }
        Returns: string
      }
      get_my_event_applications: {
        Args: { p_event_ids: string[] }
        Returns: {
          created_at: string
          decisions_release_at: string
          event_id: string
          id: string
          offer_expires_at: string
          status: Database["public"]["Enums"]["event_application_status"]
          submitted_at: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_info_id: { Args: Record<PropertyKey, never>; Returns: string }
      initialize_event_checkout: {
        Args: {
          p_event_id: string
          p_expected_amount_cents?: number
          p_free_only?: boolean
          p_idempotency_key: string
          p_user_id: string
        }
        Returns: {
          amount_cents: number
          created: boolean
          failure_reason: string
          purchase_id: string
        }[]
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_authenticated: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_manager: { Args: Record<PropertyKey, never>; Returns: boolean }
      join_team: {
        Args: { p_invite_code: string; p_user_id: string }
        Returns: {
          failure_reason: string
          team_id: string
        }[]
      }
      leave_team: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: string
      }
      mutate_item_check_in: {
        Args: {
          p_event_id: string
          p_item_id: string
          p_method?: string
          p_qr_token?: string
          p_ticket_id?: string
          p_undo_version?: string
        }
        Returns: Json
      }
      owns_event_application: {
        Args: { p_application_id: string }
        Returns: boolean
      }
      participant_agenda_location: {
        Args: { p_location: Json; p_restricted: boolean }
        Returns: Json
      }
      publish_due_events: { Args: Record<PropertyKey, never>; Returns: number }
      purchase_is_live: { Args: { p_purchase_id: string }; Returns: boolean }
      regenerate_event_ticket_token: {
        Args: { p_ticket_id: string }
        Returns: boolean
      }
      release_application_emails: {
        Args: { p_delivery_ids: string[]; p_reason?: string }
        Returns: number
      }
      release_event_ticket: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      remove_event_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      rename_team: {
        Args: { p_name: string; p_team_id: string; p_user_id: string }
        Returns: string
      }
      reschedule_event_publication: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reserve_event_ticket: {
        Args: { p_event_id: string; p_purchase_id?: string; p_user_id: string }
        Returns: {
          failure_reason: string
          ticket_id: string
        }[]
      }
      safe_event_content_url: { Args: { p_url: string }; Returns: boolean }
      safe_staff_schedule_url: { Args: { p_url: string }; Returns: boolean }
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
      save_admin_event_before_agenda: {
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
      save_admin_event_before_application_settings: {
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
      save_admin_event_before_content: {
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
      save_admin_event_before_date_locations: {
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
      save_admin_event_builder: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_builder_before_agenda_timing: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_builder_before_cancellation: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_builder_before_publication: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_builder_before_safe_mutations: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_builder_before_unified_drafts: {
        Args: {
          p_application_questions: Json
          p_check_in_sessions: Json
          p_draft_id: string
          p_draft_revision: number
          p_event: Json
          p_event_id: string
          p_expected_header_image_url: string
          p_expected_image_url: string
          p_mentors: Json
          p_slug: string
          p_sponsors: Json
        }
        Returns: Json
      }
      save_admin_event_draft: {
        Args: {
          p_document: Json
          p_event_id: string
          p_id: string
          p_revision: number
        }
        Returns: Json
      }
      save_admin_event_draft_before_url_activation: {
        Args: {
          p_document: Json
          p_event_id: string
          p_id: string
          p_revision: number
        }
        Returns: Json
      }
      save_agenda_note: {
        Args: {
          p_body: string
          p_event_id: string
          p_expected_revision: number
          p_item_id: string
        }
        Returns: Json
      }
      save_event_application_questions: {
        Args: { p_event_id: string; p_questions: Json }
        Returns: Json
      }
      save_event_check_in_sessions: {
        Args: { p_event_id: string; p_sessions: Json }
        Returns: Json
      }
      save_event_working_document: {
        Args: {
          p_document: Json
          p_event_id: string
          p_event_revision?: number
          p_id: string
          p_operation_id?: string
          p_revision: number
        }
        Returns: Json
      }
      save_past_event_resources: {
        Args: {
          p_event_id: string
          p_links: Json
          p_operation_id: string
          p_resources_version?: number
          p_revision: number
        }
        Returns: Json
      }
      set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["role_access_enum"]
          p_target_user_id: string
        }
        Returns: Database["public"]["Enums"]["role_access_enum"]
      }
      submit_event_application: {
        Args: { p_application_id: string }
        Returns: {
          missing_question_ids: string[]
          status: string
        }[]
      }
      sync_staff_schedule: {
        Args: { p_document: Json; p_draft: boolean; p_event_id: string }
        Returns: undefined
      }
      team_change_blocked: {
        Args: { p_event_id: string; p_user_id: string }
        Returns: string
      }
      update_admin_event_schedule: {
        Args: { p_event_id: string; p_patch: Json }
        Returns: {
          agenda: Json | null
          agenda_enabled: boolean
          canceled_at: string | null
          cancellation_note: string | null
          configured_marketing_mode: string | null
          configured_marketing_url: string | null
          configured_price: number | null
          configured_pricing_mode: string | null
          configured_slug: string | null
          configured_slug_edited: boolean
          created_at: string | null
          description: string | null
          description_images: string[] | null
          description_rich: Json | null
          ends_at: string | null
          event_colour: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          first_published_at: string | null
          header_colour: string | null
          header_image_url: string | null
          id: string
          image_url: string | null
          is_featured: boolean
          legacy_draft_ids: string[]
          location_address: string | null
          location_address_url: string | null
          location_building: string | null
          location_room: string | null
          location_type: Database["public"]["Enums"]["event_location_type"]
          marketing_url: string | null
          max_capacity: number | null
          max_team_size: number | null
          member_price: number | null
          mentors_enabled: boolean
          min_team_size: number | null
          name: string
          pricing_policy: string
          publish_at: string | null
          registration_closes_at: string | null
          registration_opens_at: string | null
          regular_price: number | null
          requires_application: boolean
          revision: number
          short_description: string | null
          slug: string
          sponsors_enabled: boolean
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          team_deadline: string | null
          teams_enabled: boolean
          updated_at: string | null
          working_document: Json | null
          working_revision: number
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      valid_option_list: {
        Args: { allowed: string[]; choices: string[] }
        Returns: boolean
      }
      valid_other_allergies: { Args: { entries: string[] }; Returns: boolean }
      valid_user_interests: { Args: { tags: string[] }; Returns: boolean }
      validate_event_content: {
        Args: { p_document: Json; p_draft?: boolean }
        Returns: undefined
      }
      validate_staff_schedule_content: {
        Args: { p_document: Json; p_draft?: boolean }
        Returns: undefined
      }
      void_event_ticket: { Args: { p_ticket_id: string }; Returns: string }
    }
    Enums: {
      audit_event_source: "admin_change" | "user_activity"
      event_application_status:
        | "draft"
        | "submitted"
        | "accepted"
        | "rejected"
        | "waitlisted"
      event_link_type:
        | "slack_workspace"
        | "participant_package"
        | "event_recap"
        | "other"
      event_link_visibility: "everyone" | "going" | "after_event"
      event_location_type: "in_person" | "online" | "hybrid"
      event_status: "draft" | "active"
      event_type: "regular" | "flagship"
      response_type:
        | "short_text"
        | "long_text"
        | "checkbox"
        | "multiple_choice"
        | "dropdown"
        | "file_upload"
      role_access_enum: "basic" | "admin" | "manager"
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
      audit_event_source: ["admin_change", "user_activity"],
      event_application_status: [
        "draft",
        "submitted",
        "accepted",
        "rejected",
        "waitlisted",
      ],
      event_link_type: [
        "slack_workspace",
        "participant_package",
        "event_recap",
        "other",
      ],
      event_link_visibility: ["everyone", "going", "after_event"],
      event_location_type: ["in_person", "online", "hybrid"],
      event_status: ["draft", "active"],
      event_type: ["regular", "flagship"],
      response_type: [
        "short_text",
        "long_text",
        "checkbox",
        "multiple_choice",
        "dropdown",
        "file_upload",
      ],
      role_access_enum: ["basic", "admin", "manager"],
      student_status: ["undergraduate", "graduate", "other"],
      uni_year: ["1", "2", "3", "4", "5+"],
      user_type: ["ubcStudent", "faculty", "nonUbc"],
    },
  },
} as const
