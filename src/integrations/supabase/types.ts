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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      admin_content: {
        Row: {
          blog_category: string | null
          content: string | null
          content_type: string
          created_at: string
          created_by: string
          description: string | null
          destination: string
          external_link: string | null
          file_url: string | null
          id: string
          title: string
          updated_at: string
          updated_by: string
          url: string | null
        }
        Insert: {
          blog_category?: string | null
          content?: string | null
          content_type: string
          created_at?: string
          created_by: string
          description?: string | null
          destination: string
          external_link?: string | null
          file_url?: string | null
          id?: string
          title: string
          updated_at?: string
          updated_by: string
          url?: string | null
        }
        Update: {
          blog_category?: string | null
          content?: string | null
          content_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          destination?: string
          external_link?: string | null
          file_url?: string | null
          id?: string
          title?: string
          updated_at?: string
          updated_by?: string
          url?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          bairro: string | null
          cep: string
          cidade: string | null
          cnpj: string
          complemento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string | null
          created_by: string | null
          empresa_id_externo: number
          id: string
          logradouro: string | null
          n_funcionarios: number
          numero: string | null
          plano_id_externo: number
          razao_social: string
          status: string
          uf: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          bairro?: string | null
          cep: string
          cidade?: string | null
          cnpj: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id_externo?: number
          id?: string
          logradouro?: string | null
          n_funcionarios?: number
          numero?: string | null
          plano_id_externo?: number
          razao_social: string
          status?: string
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string
          cidade?: string | null
          cnpj?: string
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          created_by?: string | null
          empresa_id_externo?: number
          id?: string
          logradouro?: string | null
          n_funcionarios?: number
          numero?: string | null
          plano_id_externo?: number
          razao_social?: string
          status?: string
          uf?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      company_credentials: {
        Row: {
          company_id: string
          created_at: string | null
          failed_login_attempts: number
          id: string
          last_failed_login_at: string | null
          last_login_at: string | null
          must_change_password: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          failed_login_attempts?: number
          id?: string
          last_failed_login_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          failed_login_attempts?: number
          id?: string
          last_failed_login_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_employees: {
        Row: {
          bairro: string
          cep: string
          cidade: string
          company_id: string
          complemento: string | null
          cpf: string
          created_at: string | null
          datanascimento: string
          email: string
          empresa_id_externo: number
          estado: string
          fotobase64: string | null
          has_active_plan: boolean
          id: string
          logradouro: string
          nome: string
          numero: string
          plano_id_externo: number
          sexo: string
          telefone: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bairro: string
          cep: string
          cidade: string
          company_id: string
          complemento?: string | null
          cpf: string
          created_at?: string | null
          datanascimento: string
          email: string
          empresa_id_externo?: number
          estado: string
          fotobase64?: string | null
          has_active_plan?: boolean
          id?: string
          logradouro: string
          nome: string
          numero: string
          plano_id_externo?: number
          sexo: string
          telefone: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bairro?: string
          cep?: string
          cidade?: string
          company_id?: string
          complemento?: string | null
          cpf?: string
          created_at?: string | null
          datanascimento?: string
          email?: string
          empresa_id_externo?: number
          estado?: string
          fotobase64?: string | null
          has_active_plan?: boolean
          id?: string
          logradouro?: string
          nome?: string
          numero?: string
          plano_id_externo?: number
          sexo?: string
          telefone?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_employees_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      metrics: {
        Row: {
          amount_cents: number | null
          company_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          patient_email: string | null
          plan_code: string | null
          platform: string | null
          specialty: string | null
          status: string | null
        }
        Insert: {
          amount_cents?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          patient_email?: string | null
          plan_code?: string | null
          platform?: string | null
          specialty?: string | null
          status?: string | null
        }
        Update: {
          amount_cents?: number | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          patient_email?: string | null
          plan_code?: string | null
          platform?: string | null
          specialty?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_plans: {
        Row: {
          created_at: string | null
          email: string
          id: string
          plan_code: string
          plan_expires_at: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          plan_code: string
          plan_expires_at: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          plan_code?: string
          plan_expires_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      patients: {
        Row: {
          address_complement: string | null
          address_line: string | null
          address_number: string | null
          allergies: string | null
          birth_date: string | null
          cep: string | null
          chronic_meds: string | null
          city: string | null
          comorbidities: string | null
          cpf: string | null
          created_at: string | null
          first_name: string | null
          gender: string | null
          has_allergies: boolean | null
          has_chronic_meds: boolean | null
          has_comorbidities: boolean | null
          id: string
          intake_complete: boolean | null
          last_name: string | null
          marketing_opt_in: boolean | null
          phone_e164: string | null
          pregnancy_status: string | null
          profile_complete: boolean | null
          source: string | null
          state: string | null
          terms_accepted_at: string | null
          updated_at: string | null
        }
        Insert: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          allergies?: string | null
          birth_date?: string | null
          cep?: string | null
          chronic_meds?: string | null
          city?: string | null
          comorbidities?: string | null
          cpf?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          has_allergies?: boolean | null
          has_chronic_meds?: boolean | null
          has_comorbidities?: boolean | null
          id: string
          intake_complete?: boolean | null
          last_name?: string | null
          marketing_opt_in?: boolean | null
          phone_e164?: string | null
          pregnancy_status?: string | null
          profile_complete?: boolean | null
          source?: string | null
          state?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Update: {
          address_complement?: string | null
          address_line?: string | null
          address_number?: string | null
          allergies?: string | null
          birth_date?: string | null
          cep?: string | null
          chronic_meds?: string | null
          city?: string | null
          comorbidities?: string | null
          cpf?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          has_allergies?: boolean | null
          has_chronic_meds?: boolean | null
          has_comorbidities?: boolean | null
          id?: string
          intake_complete?: boolean | null
          last_name?: string | null
          marketing_opt_in?: boolean | null
          phone_e164?: string | null
          pregnancy_status?: string | null
          profile_complete?: boolean | null
          source?: string | null
          state?: string | null
          terms_accepted_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean | null
          allows_recurring: boolean | null
          created_at: string | null
          id: string
          name: string
          price_cents: number
          recurring_frequency: number | null
          recurring_frequency_type: string | null
          sku: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          allows_recurring?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          price_cents: number
          recurring_frequency?: number | null
          recurring_frequency_type?: string | null
          sku: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          allows_recurring?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          price_cents?: number
          recurring_frequency?: number | null
          recurring_frequency_type?: string | null
          sku?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_email: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "company"
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
      app_role: ["admin", "user", "company"],
    },
  },
} as const
