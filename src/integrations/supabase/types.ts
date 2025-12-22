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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string | null
          created_at: string
          description: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          description: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          description?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          city: string | null
          created_at: string
          id: string
          last_permit_date: string | null
          name: string
          operator_number: string | null
          permit_count: number | null
          score: string | null
          state: string | null
          total_value: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          last_permit_date?: string | null
          name: string
          operator_number?: string | null
          permit_count?: number | null
          score?: string | null
          state?: string | null
          total_value?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          last_permit_date?: string | null
          name?: string
          operator_number?: string | null
          permit_count?: number | null
          score?: string | null
          state?: string | null
          total_value?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      datasets: {
        Row: {
          created_at: string
          file_name: string | null
          id: string
          is_active: boolean | null
          name: string
          permit_count: number | null
          skipped_rows: number | null
          user_id: string
          valid_rows: number | null
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          permit_count?: number | null
          skipped_rows?: number | null
          user_id: string
          valid_rows?: number | null
        }
        Update: {
          created_at?: string
          file_name?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          permit_count?: number | null
          skipped_rows?: number | null
          user_id?: string
          valid_rows?: number | null
        }
        Relationships: []
      }
      deals: {
        Row: {
          company_id: string | null
          created_at: string
          expected_close_date: string | null
          id: string
          linked_permit_ids: string[] | null
          name: string
          notes: string | null
          probability: number | null
          selling_option_id: string | null
          stage: string | null
          status: string | null
          user_id: string
          value: number | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          linked_permit_ids?: string[] | null
          name: string
          notes?: string | null
          probability?: number | null
          selling_option_id?: string | null
          stage?: string | null
          status?: string | null
          user_id: string
          value?: number | null
        }
        Update: {
          company_id?: string | null
          created_at?: string
          expected_close_date?: string | null
          id?: string
          linked_permit_ids?: string[] | null
          name?: string
          notes?: string | null
          probability?: number | null
          selling_option_id?: string | null
          stage?: string | null
          status?: string | null
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_selling_option_id_fkey"
            columns: ["selling_option_id"]
            isOneToOne: false
            referencedRelation: "selling_options"
            referencedColumns: ["id"]
          },
        ]
      }
      permits: {
        Row: {
          api: string
          application_type: string | null
          approval_date: string | null
          assigned_to: string | null
          city: string | null
          county: string | null
          created_at: string
          dataset_id: string | null
          date_imported: string
          drill_type: string | null
          estimated_value: number | null
          expire_date: string | null
          formation_code: string | null
          formation_depth: number | null
          formation_name: string | null
          id: string
          image_url: string | null
          lat: number
          lon: number
          measured_total_depth: number | null
          operator: string
          operator_number: string | null
          permit_status: string | null
          permit_type: string | null
          range: string | null
          remarks: string | null
          section: string | null
          sign_name: string | null
          state: string | null
          submit_date: string | null
          total_depth: number | null
          township: string | null
          true_vertical_depth: number | null
          user_id: string
          well_class: string | null
          well_name: string | null
          well_number: string | null
          well_status: string | null
          well_type: string | null
          zip_code: string | null
        }
        Insert: {
          api: string
          application_type?: string | null
          approval_date?: string | null
          assigned_to?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dataset_id?: string | null
          date_imported?: string
          drill_type?: string | null
          estimated_value?: number | null
          expire_date?: string | null
          formation_code?: string | null
          formation_depth?: number | null
          formation_name?: string | null
          id?: string
          image_url?: string | null
          lat: number
          lon: number
          measured_total_depth?: number | null
          operator: string
          operator_number?: string | null
          permit_status?: string | null
          permit_type?: string | null
          range?: string | null
          remarks?: string | null
          section?: string | null
          sign_name?: string | null
          state?: string | null
          submit_date?: string | null
          total_depth?: number | null
          township?: string | null
          true_vertical_depth?: number | null
          user_id: string
          well_class?: string | null
          well_name?: string | null
          well_number?: string | null
          well_status?: string | null
          well_type?: string | null
          zip_code?: string | null
        }
        Update: {
          api?: string
          application_type?: string | null
          approval_date?: string | null
          assigned_to?: string | null
          city?: string | null
          county?: string | null
          created_at?: string
          dataset_id?: string | null
          date_imported?: string
          drill_type?: string | null
          estimated_value?: number | null
          expire_date?: string | null
          formation_code?: string | null
          formation_depth?: number | null
          formation_name?: string | null
          id?: string
          image_url?: string | null
          lat?: number
          lon?: number
          measured_total_depth?: number | null
          operator?: string
          operator_number?: string | null
          permit_status?: string | null
          permit_type?: string | null
          range?: string | null
          remarks?: string | null
          section?: string | null
          sign_name?: string | null
          state?: string | null
          submit_date?: string | null
          total_depth?: number | null
          township?: string | null
          true_vertical_depth?: number | null
          user_id?: string
          well_class?: string | null
          well_name?: string | null
          well_number?: string | null
          well_status?: string | null
          well_type?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      selling_options: {
        Row: {
          annual_maintenance: number | null
          annual_rental: number | null
          category: string
          created_at: string
          default_price: number
          description: string | null
          id: string
          name: string
          trigger_type: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_maintenance?: number | null
          annual_rental?: number | null
          category?: string
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          name: string
          trigger_type?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_maintenance?: number | null
          annual_rental?: number | null
          category?: string
          created_at?: string
          default_price?: number
          description?: string | null
          id?: string
          name?: string
          trigger_type?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
