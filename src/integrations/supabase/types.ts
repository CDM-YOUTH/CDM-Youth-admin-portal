// This file is hand-maintained (see packages/shared/src/supabase/types.ts,
// which mirrors it) — the two must be kept in sync since both apps share one
// database. Known gap: `role_permissions` isn't modeled here yet (existed
// before this file was hand-maintained); see admin.users.tsx callers.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cusa_members: {
        Row: {
          course: string | null;
          created_at: string;
          id: string;
          institution: string;
          leadership_role: string | null;
          year: number;
          year_of_study: string | null;
          youth_id: string;
        };
        Insert: {
          course?: string | null;
          created_at?: string;
          id?: string;
          institution: string;
          leadership_role?: string | null;
          year?: number;
          year_of_study?: string | null;
          youth_id: string;
        };
        Update: {
          course?: string | null;
          created_at?: string;
          id?: string;
          institution?: string;
          leadership_role?: string | null;
          year?: number;
          year_of_study?: string | null;
          youth_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cusa_members_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      cusa_transitions: {
        Row: {
          created_at: string;
          effective_date: string;
          from_category: string | null;
          id: string;
          processed_by: string | null;
          reason: string | null;
          to_category: string;
          youth_id: string;
        };
        Insert: {
          created_at?: string;
          effective_date?: string;
          from_category?: string | null;
          id?: string;
          processed_by?: string | null;
          reason?: string | null;
          to_category: string;
          youth_id: string;
        };
        Update: {
          created_at?: string;
          effective_date?: string;
          from_category?: string | null;
          id?: string;
          processed_by?: string | null;
          reason?: string | null;
          to_category?: string;
          youth_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cusa_transitions_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      deaneries: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      enrollment_audit_log: {
        Row: {
          action: string;
          actor: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          enrollment_id: string | null;
          id: string;
          youth_id: string | null;
        };
        Insert: {
          action: string;
          actor?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          enrollment_id?: string | null;
          id?: string;
          youth_id?: string | null;
        };
        Update: {
          action?: string;
          actor?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          enrollment_id?: string | null;
          id?: string;
          youth_id?: string | null;
        };
        Relationships: [];
      };
      enrollments: {
        Row: {
          amount: number | null;
          category: Database["public"]["Enums"]["youth_category"] | null;
          created_at: string;
          id: string;
          notes: string | null;
          payment_ref: string | null;
          status: Database["public"]["Enums"]["enrollment_status"];
          year: number;
          youth_id: string;
        };
        Insert: {
          amount?: number | null;
          category?: Database["public"]["Enums"]["youth_category"] | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_ref?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          year?: number;
          youth_id: string;
        };
        Update: {
          amount?: number | null;
          category?: Database["public"]["Enums"]["youth_category"] | null;
          created_at?: string;
          id?: string;
          notes?: string | null;
          payment_ref?: string | null;
          status?: Database["public"]["Enums"]["enrollment_status"];
          year?: number;
          youth_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      event_checkins: {
        Row: {
          checked_in_at: string;
          event_id: string;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          method: Database["public"]["Enums"]["checkin_method"];
          youth_id: string | null;
        };
        Insert: {
          checked_in_at?: string;
          event_id: string;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["checkin_method"];
          youth_id?: string | null;
        };
        Update: {
          checked_in_at?: string;
          event_id?: string;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["checkin_method"];
          youth_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_checkins_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      event_duties: {
        Row: {
          category_id: string;
          created_at: string;
          fields: Json;
          id: string;
          position: number;
          title: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          fields?: Json;
          id?: string;
          position?: number;
          title: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          fields?: Json;
          id?: string;
          position?: number;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "event_duties_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "event_duty_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      event_duty_assignees: {
        Row: {
          created_at: string;
          deanery_id: string | null;
          duty_id: string;
          id: string;
          name: string;
          parish_id: string | null;
          youth_id: string | null;
        };
        Insert: {
          created_at?: string;
          deanery_id?: string | null;
          duty_id: string;
          id?: string;
          name: string;
          parish_id?: string | null;
          youth_id?: string | null;
        };
        Update: {
          created_at?: string;
          deanery_id?: string | null;
          duty_id?: string;
          id?: string;
          name?: string;
          parish_id?: string | null;
          youth_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_duty_assignees_deanery_id_fkey";
            columns: ["deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_duty_assignees_duty_id_fkey";
            columns: ["duty_id"];
            isOneToOne: false;
            referencedRelation: "event_duties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_duty_assignees_parish_id_fkey";
            columns: ["parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "event_duty_assignees_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      event_duty_categories: {
        Row: {
          created_at: string;
          event_id: string;
          id: string;
          name: string;
          position: number;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          id?: string;
          name: string;
          position?: number;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "event_duty_categories_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_program_items: {
        Row: {
          activity: string;
          created_at: string;
          end_time: string | null;
          event_id: string;
          id: string;
          position: number;
          start_time: string | null;
        };
        Insert: {
          activity: string;
          created_at?: string;
          end_time?: string | null;
          event_id: string;
          id?: string;
          position?: number;
          start_time?: string | null;
        };
        Update: {
          activity?: string;
          created_at?: string;
          end_time?: string | null;
          event_id?: string;
          id?: string;
          position?: number;
          start_time?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_program_items_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      event_registrations: {
        Row: {
          created_at: string;
          event_id: string;
          guest_email: string | null;
          guest_name: string | null;
          guest_phone: string | null;
          id: string;
          notes: string | null;
          youth_id: string | null;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          notes?: string | null;
          youth_id?: string | null;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          guest_email?: string | null;
          guest_name?: string | null;
          guest_phone?: string | null;
          id?: string;
          notes?: string | null;
          youth_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "events";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          created_at: string;
          deanery_id: string | null;
          description: string | null;
          event_date: string | null;
          id: string;
          name: string;
          organization_level: Database["public"]["Enums"]["event_org_level"] | null;
          outstation_id: string | null;
          parish_id: string | null;
          poster_url: string | null;
          updated_at: string;
          venue: string | null;
        };
        Insert: {
          created_at?: string;
          deanery_id?: string | null;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          name: string;
          organization_level?: Database["public"]["Enums"]["event_org_level"] | null;
          outstation_id?: string | null;
          parish_id?: string | null;
          poster_url?: string | null;
          updated_at?: string;
          venue?: string | null;
        };
        Update: {
          created_at?: string;
          deanery_id?: string | null;
          description?: string | null;
          event_date?: string | null;
          id?: string;
          name?: string;
          organization_level?: Database["public"]["Enums"]["event_org_level"] | null;
          outstation_id?: string | null;
          parish_id?: string | null;
          poster_url?: string | null;
          updated_at?: string;
          venue?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_deanery_id_fkey";
            columns: ["deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_outstation_id_fkey";
            columns: ["outstation_id"];
            isOneToOne: false;
            referencedRelation: "outstations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_parish_id_fkey";
            columns: ["parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_nominees: {
        Row: {
          created_at: string;
          id: string;
          mission_week_id: string;
          source_parish_id: string | null;
          status: Database["public"]["Enums"]["mission_nominee_status"];
          youth_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          mission_week_id: string;
          source_parish_id?: string | null;
          status?: Database["public"]["Enums"]["mission_nominee_status"];
          youth_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          mission_week_id?: string;
          source_parish_id?: string | null;
          status?: Database["public"]["Enums"]["mission_nominee_status"];
          youth_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_nominees_mission_week_id_fkey";
            columns: ["mission_week_id"];
            isOneToOne: false;
            referencedRelation: "mission_weeks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_nominees_source_parish_id_fkey";
            columns: ["source_parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_nominees_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_pairings: {
        Row: {
          created_at: string;
          host_deanery_id: string | null;
          host_outstation_id: string | null;
          host_parish_id: string | null;
          id: string;
          mission_week_id: string;
          report_submitted_at: string | null;
          report_summary: string | null;
          status: Database["public"]["Enums"]["mission_pairing_status"];
          youth_id: string;
        };
        Insert: {
          created_at?: string;
          host_deanery_id?: string | null;
          host_outstation_id?: string | null;
          host_parish_id?: string | null;
          id?: string;
          mission_week_id: string;
          report_submitted_at?: string | null;
          report_summary?: string | null;
          status?: Database["public"]["Enums"]["mission_pairing_status"];
          youth_id: string;
        };
        Update: {
          created_at?: string;
          host_deanery_id?: string | null;
          host_outstation_id?: string | null;
          host_parish_id?: string | null;
          id?: string;
          mission_week_id?: string;
          report_submitted_at?: string | null;
          report_summary?: string | null;
          status?: Database["public"]["Enums"]["mission_pairing_status"];
          youth_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mission_pairings_host_deanery_id_fkey";
            columns: ["host_deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_pairings_host_outstation_id_fkey";
            columns: ["host_outstation_id"];
            isOneToOne: false;
            referencedRelation: "outstations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_pairings_host_parish_id_fkey";
            columns: ["host_parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_pairings_mission_week_id_fkey";
            columns: ["mission_week_id"];
            isOneToOne: false;
            referencedRelation: "mission_weeks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mission_pairings_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_phases: {
        Row: {
          created_at: string;
          id: string;
          mission_week_id: string;
          name: string;
          phase_date: string | null;
          position: number;
          status: Database["public"]["Enums"]["mission_phase_status"];
        };
        Insert: {
          created_at?: string;
          id?: string;
          mission_week_id: string;
          name: string;
          phase_date?: string | null;
          position?: number;
          status?: Database["public"]["Enums"]["mission_phase_status"];
        };
        Update: {
          created_at?: string;
          id?: string;
          mission_week_id?: string;
          name?: string;
          phase_date?: string | null;
          position?: number;
          status?: Database["public"]["Enums"]["mission_phase_status"];
        };
        Relationships: [
          {
            foreignKeyName: "mission_phases_mission_week_id_fkey";
            columns: ["mission_week_id"];
            isOneToOne: false;
            referencedRelation: "mission_weeks";
            referencedColumns: ["id"];
          },
        ];
      };
      mission_weeks: {
        Row: {
          created_at: string;
          end_date: string | null;
          id: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["mission_week_status"];
          theme: string | null;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["mission_week_status"];
          theme?: string | null;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          end_date?: string | null;
          id?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["mission_week_status"];
          theme?: string | null;
          updated_at?: string;
          year?: number;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string | null;
          category: Database["public"]["Enums"]["notification_category"];
          created_at: string;
          id: string;
          is_read: boolean;
          related_id: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body?: string | null;
          category?: Database["public"]["Enums"]["notification_category"];
          created_at?: string;
          id?: string;
          is_read?: boolean;
          related_id?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          category?: Database["public"]["Enums"]["notification_category"];
          created_at?: string;
          id?: string;
          is_read?: boolean;
          related_id?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      otp_codes: {
        Row: {
          attempts: number;
          code_hash: string;
          consumed_at: string | null;
          created_at: string;
          expires_at: string;
          id: string;
          phone: string;
          purpose: Database["public"]["Enums"]["otp_purpose"];
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at: string;
          id?: string;
          phone: string;
          purpose?: Database["public"]["Enums"]["otp_purpose"];
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          consumed_at?: string | null;
          created_at?: string;
          expires_at?: string;
          id?: string;
          phone?: string;
          purpose?: Database["public"]["Enums"]["otp_purpose"];
        };
        Relationships: [];
      };
      outstations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          parish_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          parish_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          parish_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "outstations_parish_id_fkey";
            columns: ["parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          phone: string | null;
          position: string | null;
          deanery_id: string | null;
          parish_id: string | null;
          outstation_id: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          phone?: string | null;
          position?: string | null;
          deanery_id?: string | null;
          parish_id?: string | null;
          outstation_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          phone?: string | null;
          position?: string | null;
          deanery_id?: string | null;
          parish_id?: string | null;
          outstation_id?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_deanery_id_fkey";
            columns: ["deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_parish_id_fkey";
            columns: ["parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_outstation_id_fkey";
            columns: ["outstation_id"];
            isOneToOne: false;
            referencedRelation: "outstations";
            referencedColumns: ["id"];
          },
        ];
      };
      parishes: {
        Row: {
          created_at: string;
          deanery_id: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          deanery_id: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          deanery_id?: string;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parishes_deanery_id_fkey";
            columns: ["deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          id: string;
          role: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          role: string;
          user_id: string;
        };
        Update: {
          id?: string;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey";
            columns: ["role"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["name"];
          },
        ];
      };
      roles: {
        Row: {
          name: string;
          label: string;
          description: string | null;
          color: string | null;
          is_system: boolean;
          created_at: string;
        };
        Insert: {
          name: string;
          label: string;
          description?: string | null;
          color?: string | null;
          is_system?: boolean;
          created_at?: string;
        };
        Update: {
          name?: string;
          label?: string;
          description?: string | null;
          color?: string | null;
          is_system?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      welfare_cases: {
        Row: {
          id: string;
          case_ref: string;
          category: string;
          urgency: Database["public"]["Enums"]["welfare_urgency"];
          status: Database["public"]["Enums"]["welfare_status"];
          parish_id: string | null;
          parish_name: string | null;
          youth_id: string | null;
          cdm_id: string | null;
          assigned_to: string | null;
          notes: string | null;
          opened_at: string;
          resolved_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_ref?: string;
          category: string;
          urgency?: Database["public"]["Enums"]["welfare_urgency"];
          status?: Database["public"]["Enums"]["welfare_status"];
          parish_id?: string | null;
          parish_name?: string | null;
          youth_id?: string | null;
          cdm_id?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
          opened_at?: string;
          resolved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          case_ref?: string;
          category?: string;
          urgency?: Database["public"]["Enums"]["welfare_urgency"];
          status?: Database["public"]["Enums"]["welfare_status"];
          parish_id?: string | null;
          parish_name?: string | null;
          youth_id?: string | null;
          cdm_id?: string | null;
          assigned_to?: string | null;
          notes?: string | null;
          opened_at?: string;
          resolved_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "welfare_cases_youth_id_fkey";
            columns: ["youth_id"];
            isOneToOne: false;
            referencedRelation: "youths";
            referencedColumns: ["id"];
          },
        ];
      };
      uniform_skus: {
        Row: {
          id: string;
          name: string;
          swatch: string | null;
          in_stock: number;
          on_order: number;
          unit_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          swatch?: string | null;
          in_stock?: number;
          on_order?: number;
          unit_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          swatch?: string | null;
          in_stock?: number;
          on_order?: number;
          unit_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      uniform_orders: {
        Row: {
          id: string;
          sku_id: string | null;
          item_name: string;
          quantity: number;
          supplier: string | null;
          deanery_id: string | null;
          deanery_name: string | null;
          estimated_delivery: string | null;
          status: Database["public"]["Enums"]["order_status"];
          notes: string | null;
          ordered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku_id?: string | null;
          item_name: string;
          quantity: number;
          supplier?: string | null;
          deanery_id?: string | null;
          deanery_name?: string | null;
          estimated_delivery?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          notes?: string | null;
          ordered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku_id?: string | null;
          item_name?: string;
          quantity?: number;
          supplier?: string | null;
          deanery_id?: string | null;
          deanery_name?: string | null;
          estimated_delivery?: string | null;
          status?: Database["public"]["Enums"]["order_status"];
          notes?: string | null;
          ordered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      uniform_sales: {
        Row: {
          id: string;
          sku_id: string | null;
          item_name: string;
          youth_name: string;
          youth_id: string | null;
          size: string | null;
          parish_name: string | null;
          quantity: number;
          unit_price: number;
          ordered_at: string;
          delivered_at: string | null;
          paid_at: string | null;
          paid_amount: number;
          payment_status: Database["public"]["Enums"]["uniform_payment_status"];
          notes: string | null;
          order_ref: string;
          stage: Database["public"]["Enums"]["uniform_order_stage"];
          delivery_location: string | null;
          confirmed_at: string | null;
          confirmed_by: string | null;
          dispatch_contact_name: string | null;
          dispatch_contact_phone: string | null;
          dispatch_method: string | null;
          dispatch_scheduled_at: string | null;
          dispatched_at: string | null;
          delivered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku_id?: string | null;
          item_name: string;
          youth_name: string;
          youth_id?: string | null;
          size?: string | null;
          parish_name?: string | null;
          quantity?: number;
          unit_price?: number;
          ordered_at?: string;
          delivered_at?: string | null;
          paid_at?: string | null;
          paid_amount?: number;
          payment_status?: Database["public"]["Enums"]["uniform_payment_status"];
          notes?: string | null;
          order_ref?: string;
          stage?: Database["public"]["Enums"]["uniform_order_stage"];
          delivery_location?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          dispatch_contact_name?: string | null;
          dispatch_contact_phone?: string | null;
          dispatch_method?: string | null;
          dispatch_scheduled_at?: string | null;
          dispatched_at?: string | null;
          delivered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku_id?: string | null;
          item_name?: string;
          youth_name?: string;
          youth_id?: string | null;
          size?: string | null;
          parish_name?: string | null;
          quantity?: number;
          unit_price?: number;
          ordered_at?: string;
          delivered_at?: string | null;
          paid_at?: string | null;
          paid_amount?: number;
          payment_status?: Database["public"]["Enums"]["uniform_payment_status"];
          notes?: string | null;
          order_ref?: string;
          stage?: Database["public"]["Enums"]["uniform_order_stage"];
          delivery_location?: string | null;
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          dispatch_contact_name?: string | null;
          dispatch_contact_phone?: string | null;
          dispatch_method?: string | null;
          dispatch_scheduled_at?: string | null;
          dispatched_at?: string | null;
          delivered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "uniform_sales_sku_id_fkey";
            columns: ["sku_id"];
            isOneToOne: false;
            referencedRelation: "uniform_skus";
            referencedColumns: ["id"];
          },
        ];
      };
      uniform_stock_entries: {
        Row: {
          id: string;
          sku_id: string | null;
          item_name: string;
          quantity: number;
          notes: string | null;
          activity: Database["public"]["Enums"]["uniform_production_activity"];
          entered_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          sku_id?: string | null;
          item_name: string;
          quantity: number;
          notes?: string | null;
          activity?: Database["public"]["Enums"]["uniform_production_activity"];
          entered_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          sku_id?: string | null;
          item_name?: string;
          quantity?: number;
          notes?: string | null;
          activity?: Database["public"]["Enums"]["uniform_production_activity"];
          entered_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      formation_items: {
        Row: {
          id: string;
          title: string;
          kind: Database["public"]["Enums"]["formation_kind"];
          duration: string | null;
          author: string | null;
          tags: string[];
          description: string | null;
          content_text: string | null;
          file_url: string | null;
          views: number;
          published: boolean;
          published_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          kind?: Database["public"]["Enums"]["formation_kind"];
          duration?: string | null;
          author?: string | null;
          tags?: string[];
          description?: string | null;
          content_text?: string | null;
          file_url?: string | null;
          views?: number;
          published?: boolean;
          published_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          kind?: Database["public"]["Enums"]["formation_kind"];
          duration?: string | null;
          author?: string | null;
          tags?: string[];
          description?: string | null;
          content_text?: string | null;
          file_url?: string | null;
          views?: number;
          published?: boolean;
          published_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      formation_bookmarks: {
        Row: {
          id: string;
          user_id: string;
          formation_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          formation_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          formation_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "formation_bookmarks_formation_id_fkey";
            columns: ["formation_id"];
            isOneToOne: false;
            referencedRelation: "formation_items";
            referencedColumns: ["id"];
          },
        ];
      };
      youths: {
        Row: {
          age: number;
          alt_phone: string | null;
          auth_user_id: string | null;
          category: Database["public"]["Enums"]["youth_category"];
          cdm_id: string;
          created_at: string;
          deanery_id: string | null;
          email: string | null;
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          id: string;
          institution: string | null;
          notes: string | null;
          outstation_id: string | null;
          parish_id: string | null;
          passport_url: string | null;
          phone: string | null;
          status: Database["public"]["Enums"]["youth_status"];
          updated_at: string;
          year_of_study: string | null;
        };
        Insert: {
          age: number;
          alt_phone?: string | null;
          auth_user_id?: string | null;
          category?: Database["public"]["Enums"]["youth_category"];
          cdm_id?: string;
          created_at?: string;
          deanery_id?: string | null;
          email?: string | null;
          full_name: string;
          gender: Database["public"]["Enums"]["gender"];
          id?: string;
          institution?: string | null;
          notes?: string | null;
          outstation_id?: string | null;
          parish_id?: string | null;
          passport_url?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["youth_status"];
          updated_at?: string;
          year_of_study?: string | null;
        };
        Update: {
          age?: number;
          alt_phone?: string | null;
          auth_user_id?: string | null;
          category?: Database["public"]["Enums"]["youth_category"];
          cdm_id?: string;
          created_at?: string;
          deanery_id?: string | null;
          email?: string | null;
          full_name?: string;
          gender?: Database["public"]["Enums"]["gender"];
          id?: string;
          institution?: string | null;
          notes?: string | null;
          outstation_id?: string | null;
          parish_id?: string | null;
          passport_url?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["youth_status"];
          updated_at?: string;
          year_of_study?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "youths_deanery_id_fkey";
            columns: ["deanery_id"];
            isOneToOne: false;
            referencedRelation: "deaneries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "youths_outstation_id_fkey";
            columns: ["outstation_id"];
            isOneToOne: false;
            referencedRelation: "outstations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "youths_parish_id_fkey";
            columns: ["parish_id"];
            isOneToOne: false;
            referencedRelation: "parishes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      can_access: {
        Args: {
          _module: string;
          _action: string;
          _row_deanery_id?: string | null;
          _row_parish_id?: string | null;
          _row_outstation_id?: string | null;
        };
        Returns: boolean;
      };
      next_cdm_id: { Args: never; Returns: string };
    };
    Enums: {
      app_role: "admin" | "moderator" | "office" | "user" | "leader";
      checkin_method: "search" | "qr" | "bulk" | "kiosk" | "walkin";
      enrollment_status: "paid" | "pending" | "waived";
      event_org_level: "Diocese" | "Deanery" | "Parish" | "Outstation";
      gender: "Female" | "Male";
      mission_nominee_status: "nominated" | "confirmed" | "withdrawn";
      mission_pairing_status: "pending" | "sent" | "received" | "reported";
      mission_phase_status: "upcoming" | "active" | "done";
      mission_week_status: "planning" | "nominations" | "pairing" | "execution" | "closed";
      notification_category:
        | "formation"
        | "event"
        | "account"
        | "enrollment"
        | "mission"
        | "welfare"
        | "uniform"
        | "general";
      otp_purpose: "password_reset";
      order_status: "pending" | "ordered" | "received" | "cancelled";
      uniform_payment_status: "unpaid" | "partial" | "paid";
      uniform_order_stage: "placed" | "confirmed" | "dispatched" | "delivered" | "cancelled";
      uniform_production_activity: "sewing" | "logo" | "branding";
      formation_kind: "PDF" | "Audio" | "Video" | "Image" | "Other";
      welfare_urgency: "low" | "medium" | "high";
      welfare_status: "open" | "in_progress" | "resolved" | "closed";
      youth_category: "Primary" | "Secondary" | "Tertiary" | "Working" | "Other";
      youth_status: "active" | "inactive";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "office", "user", "leader"],
      checkin_method: ["search", "qr", "bulk", "kiosk", "walkin"],
      enrollment_status: ["paid", "pending", "waived"],
      event_org_level: ["Diocese", "Deanery", "Parish", "Outstation"],
      gender: ["Female", "Male"],
      mission_nominee_status: ["nominated", "confirmed", "withdrawn"],
      mission_pairing_status: ["pending", "sent", "received", "reported"],
      mission_phase_status: ["upcoming", "active", "done"],
      mission_week_status: ["planning", "nominations", "pairing", "execution", "closed"],
      notification_category: [
        "formation",
        "event",
        "account",
        "enrollment",
        "mission",
        "welfare",
        "uniform",
        "general",
      ],
      otp_purpose: ["password_reset"],
      order_status: ["pending", "ordered", "received", "cancelled"],
      uniform_payment_status: ["unpaid", "partial", "paid"],
      uniform_order_stage: ["placed", "confirmed", "dispatched", "delivered", "cancelled"],
      uniform_production_activity: ["sewing", "logo", "branding"],
      formation_kind: ["PDF", "Audio", "Video", "Image", "Other"],
      welfare_urgency: ["low", "medium", "high"],
      welfare_status: ["open", "in_progress", "resolved", "closed"],
      youth_category: ["Primary", "Secondary", "Tertiary", "Working", "Other"],
      youth_status: ["active", "inactive"],
    },
  },
} as const;
