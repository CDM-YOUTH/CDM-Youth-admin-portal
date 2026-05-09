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
      cusa_members: {
        Row: {
          course: string | null
          created_at: string
          id: string
          institution: string
          leadership_role: string | null
          year_of_study: string | null
          youth_id: string
        }
        Insert: {
          course?: string | null
          created_at?: string
          id?: string
          institution: string
          leadership_role?: string | null
          year_of_study?: string | null
          youth_id: string
        }
        Update: {
          course?: string | null
          created_at?: string
          id?: string
          institution?: string
          leadership_role?: string | null
          year_of_study?: string | null
          youth_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cusa_members_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: true
            referencedRelation: "youths"
            referencedColumns: ["id"]
          },
        ]
      }
      deaneries: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          notes: string | null
          payment_ref: string | null
          status: Database["public"]["Enums"]["enrollment_status"]
          year: number
          youth_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          year?: number
          youth_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          payment_ref?: string | null
          status?: Database["public"]["Enums"]["enrollment_status"]
          year?: number
          youth_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: false
            referencedRelation: "youths"
            referencedColumns: ["id"]
          },
        ]
      }
      event_checkins: {
        Row: {
          checked_in_at: string
          event_id: string
          guest_name: string | null
          guest_phone: string | null
          id: string
          method: Database["public"]["Enums"]["checkin_method"]
          youth_id: string | null
        }
        Insert: {
          checked_in_at?: string
          event_id: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          method?: Database["public"]["Enums"]["checkin_method"]
          youth_id?: string | null
        }
        Update: {
          checked_in_at?: string
          event_id?: string
          guest_name?: string | null
          guest_phone?: string | null
          id?: string
          method?: Database["public"]["Enums"]["checkin_method"]
          youth_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkins_youth_id_fkey"
            columns: ["youth_id"]
            isOneToOne: false
            referencedRelation: "youths"
            referencedColumns: ["id"]
          },
        ]
      }
      event_duties: {
        Row: {
          category_id: string
          created_at: string
          fields: Json
          id: string
          position: number
          title: string
        }
        Insert: {
          category_id: string
          created_at?: string
          fields?: Json
          id?: string
          position?: number
          title: string
        }
        Update: {
          category_id?: string
          created_at?: string
          fields?: Json
          id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_duties_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_duty_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      event_duty_assignees: {
        Row: {
          created_at: string
          deanery_id: string | null
          duty_id: string
          id: string
          name: string
          parish_id: string | null
        }
        Insert: {
          created_at?: string
          deanery_id?: string | null
          duty_id: string
          id?: string
          name: string
          parish_id?: string | null
        }
        Update: {
          created_at?: string
          deanery_id?: string | null
          duty_id?: string
          id?: string
          name?: string
          parish_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_duty_assignees_deanery_id_fkey"
            columns: ["deanery_id"]
            isOneToOne: false
            referencedRelation: "deaneries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_duty_assignees_duty_id_fkey"
            columns: ["duty_id"]
            isOneToOne: false
            referencedRelation: "event_duties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_duty_assignees_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_duty_categories: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_duty_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_program_items: {
        Row: {
          activity: string
          created_at: string
          end_time: string | null
          event_id: string
          id: string
          position: number
          start_time: string | null
        }
        Insert: {
          activity: string
          created_at?: string
          end_time?: string | null
          event_id: string
          id?: string
          position?: number
          start_time?: string | null
        }
        Update: {
          activity?: string
          created_at?: string
          end_time?: string | null
          event_id?: string
          id?: string
          position?: number
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_program_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string
          deanery_id: string | null
          description: string | null
          event_date: string | null
          id: string
          name: string
          organization_level:
            | Database["public"]["Enums"]["event_org_level"]
            | null
          outstation_id: string | null
          parish_id: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          created_at?: string
          deanery_id?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          name: string
          organization_level?:
            | Database["public"]["Enums"]["event_org_level"]
            | null
          outstation_id?: string | null
          parish_id?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          created_at?: string
          deanery_id?: string | null
          description?: string | null
          event_date?: string | null
          id?: string
          name?: string
          organization_level?:
            | Database["public"]["Enums"]["event_org_level"]
            | null
          outstation_id?: string | null
          parish_id?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_deanery_id_fkey"
            columns: ["deanery_id"]
            isOneToOne: false
            referencedRelation: "deaneries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_outstation_id_fkey"
            columns: ["outstation_id"]
            isOneToOne: false
            referencedRelation: "outstations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
        ]
      }
      outstations: {
        Row: {
          created_at: string
          id: string
          name: string
          parish_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parish_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parish_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outstations_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
        ]
      }
      parishes: {
        Row: {
          created_at: string
          deanery_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          deanery_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          deanery_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "parishes_deanery_id_fkey"
            columns: ["deanery_id"]
            isOneToOne: false
            referencedRelation: "deaneries"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      youths: {
        Row: {
          age: number
          alt_phone: string | null
          category: Database["public"]["Enums"]["youth_category"]
          cdm_id: string
          created_at: string
          deanery_id: string | null
          email: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          id: string
          institution: string | null
          notes: string | null
          outstation_id: string | null
          parish_id: string | null
          phone: string | null
          status: Database["public"]["Enums"]["youth_status"]
          updated_at: string
          year_of_study: string | null
        }
        Insert: {
          age: number
          alt_phone?: string | null
          category?: Database["public"]["Enums"]["youth_category"]
          cdm_id?: string
          created_at?: string
          deanery_id?: string | null
          email?: string | null
          full_name: string
          gender: Database["public"]["Enums"]["gender"]
          id?: string
          institution?: string | null
          notes?: string | null
          outstation_id?: string | null
          parish_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["youth_status"]
          updated_at?: string
          year_of_study?: string | null
        }
        Update: {
          age?: number
          alt_phone?: string | null
          category?: Database["public"]["Enums"]["youth_category"]
          cdm_id?: string
          created_at?: string
          deanery_id?: string | null
          email?: string | null
          full_name?: string
          gender?: Database["public"]["Enums"]["gender"]
          id?: string
          institution?: string | null
          notes?: string | null
          outstation_id?: string | null
          parish_id?: string | null
          phone?: string | null
          status?: Database["public"]["Enums"]["youth_status"]
          updated_at?: string
          year_of_study?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "youths_deanery_id_fkey"
            columns: ["deanery_id"]
            isOneToOne: false
            referencedRelation: "deaneries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youths_outstation_id_fkey"
            columns: ["outstation_id"]
            isOneToOne: false
            referencedRelation: "outstations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "youths_parish_id_fkey"
            columns: ["parish_id"]
            isOneToOne: false
            referencedRelation: "parishes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_cdm_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      checkin_method: "search" | "qr" | "bulk" | "kiosk" | "walkin"
      enrollment_status: "paid" | "pending" | "waived"
      event_org_level: "Diocese" | "Deanery" | "Parish" | "Outstation"
      gender: "Female" | "Male"
      youth_category: "Primary" | "Secondary" | "Tertiary" | "Working"
      youth_status: "active" | "inactive"
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
      app_role: ["admin", "moderator", "user"],
      checkin_method: ["search", "qr", "bulk", "kiosk", "walkin"],
      enrollment_status: ["paid", "pending", "waived"],
      event_org_level: ["Diocese", "Deanery", "Parish", "Outstation"],
      gender: ["Female", "Male"],
      youth_category: ["Primary", "Secondary", "Tertiary", "Working"],
      youth_status: ["active", "inactive"],
    },
  },
} as const
