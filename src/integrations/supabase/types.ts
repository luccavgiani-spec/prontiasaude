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
      admin_content: {
        Row: {
          blog_category: string | null
          content: Json | null
          content_type: string | null
          created_at: string | null
          description: string | null
          destination: string | null
          external_link: string | null
          file_url: string | null
          id: string
          section: string
          title: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          blog_category?: string | null
          content?: Json | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          destination?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          section: string
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          blog_category?: string | null
          content?: Json | null
          content_type?: string | null
          created_at?: string | null
          description?: string | null
          destination?: string | null
          external_link?: string | null
          file_url?: string | null
          id?: string
          section?: string
          title?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value?: Json | null
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json | null
        }
        Relationships: []
      }
      appointments: {
        Row: {
          appointment_id: string | null
          created_at: string | null
          duration_min: number | null
          duration_minutes: number | null
          email: string | null
          external_data: Json | null
          id: string
          meeting_url: string | null
          notes: string | null
          order_id: string | null
          patient_id: string | null
          provider: string | null
          redirect_url: string | null
          scheduled_date: string | null
          service_code: string | null
          service_name: string | null
          specialty: string | null
          start_at_local: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string | null
          duration_min?: number | null
          duration_minutes?: number | null
          email?: string | null
          external_data?: Json | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          order_id?: string | null
          patient_id?: string | null
          provider?: string | null
          redirect_url?: string | null
          scheduled_date?: string | null
          service_code?: string | null
          service_name?: string | null
          specialty?: string | null
          start_at_local?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: string | null
          created_at?: string | null
          duration_min?: number | null
          duration_minutes?: number | null
          email?: string | null
          external_data?: Json | null
          id?: string
          meeting_url?: string | null
          notes?: string | null
          order_id?: string | null
          patient_id?: string | null
          provider?: string | null
          redirect_url?: string | null
          scheduled_date?: string | null
          service_code?: string | null
          service_name?: string | null
          specialty?: string | null
          start_at_local?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clicklife_registrations: {
        Row: {
          clicklife_patient_id: string | null
          cpf: string
          created_at: string | null
          error_message: string | null
          id: string
          patient_id: string | null
          registration_data: Json | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          clicklife_patient_id?: string | null
          cpf: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          patient_id?: string | null
          registration_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          clicklife_patient_id?: string | null
          cpf?: string
          created_at?: string | null
          error_message?: string | null
          id?: string
          patient_id?: string | null
          registration_data?: Json | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clicklife_registrations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string | null
          empresa_id_externo: number | null
          id: string
          logradouro: string | null
          n_funcionarios: number | null
          numero: string | null
          plano_id_externo: number | null
          razao_social: string
          status: string | null
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          empresa_id_externo?: number | null
          id?: string
          logradouro?: string | null
          n_funcionarios?: number | null
          numero?: string | null
          plano_id_externo?: number | null
          razao_social: string
          status?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          empresa_id_externo?: number | null
          id?: string
          logradouro?: string | null
          n_funcionarios?: number | null
          numero?: string | null
          plano_id_externo?: number | null
          razao_social?: string
          status?: string | null
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_credentials: {
        Row: {
          cnpj: string
          company_id: string
          created_at: string | null
          failed_login_attempts: number | null
          id: string
          is_temporary_password: boolean | null
          last_failed_login_at: string | null
          last_login_at: string | null
          must_change_password: boolean | null
          password_hash: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cnpj: string
          company_id: string
          created_at?: string | null
          failed_login_attempts?: number | null
          id?: string
          is_temporary_password?: boolean | null
          last_failed_login_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean | null
          password_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cnpj?: string
          company_id?: string
          created_at?: string | null
          failed_login_attempts?: number | null
          id?: string
          is_temporary_password?: boolean | null
          last_failed_login_at?: string | null
          last_login_at?: string | null
          must_change_password?: boolean | null
          password_hash?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_credentials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_employees: {
        Row: {
          activated_at: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          company_id: string
          complemento: string | null
          cpf: string | null
          created_at: string | null
          datanascimento: string | null
          email: string
          empresa_id_externo: number | null
          estado: string | null
          first_name: string | null
          fotobase64: string | null
          has_active_plan: boolean | null
          id: string
          invited_at: string | null
          last_name: string | null
          logradouro: string | null
          nome: string | null
          numero: string | null
          patient_id: string | null
          plano_id_externo: number | null
          sexo: string | null
          status: string | null
          telefone: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          company_id: string
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          datanascimento?: string | null
          email: string
          empresa_id_externo?: number | null
          estado?: string | null
          first_name?: string | null
          fotobase64?: string | null
          has_active_plan?: boolean | null
          id?: string
          invited_at?: string | null
          last_name?: string | null
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          patient_id?: string | null
          plano_id_externo?: number | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          company_id?: string
          complemento?: string | null
          cpf?: string | null
          created_at?: string | null
          datanascimento?: string | null
          email?: string
          empresa_id_externo?: number | null
          estado?: string | null
          first_name?: string | null
          fotobase64?: string | null
          has_active_plan?: boolean | null
          id?: string
          invited_at?: string | null
          last_name?: string | null
          logradouro?: string | null
          nome?: string | null
          numero?: string | null
          patient_id?: string | null
          plano_id_externo?: number | null
          sexo?: string | null
          status?: string | null
          telefone?: string | null
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
          {
            foreignKeyName: "company_employees_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_uses: {
        Row: {
          coupon_code: string | null
          coupon_id: string
          created_at: string | null
          discount_amount: number | null
          discount_percent: number | null
          final_amount: number | null
          id: string
          order_id: string | null
          original_amount: number | null
          owner_email: string | null
          owner_id: string | null
          owner_name: string | null
          owner_pix_key: string | null
          payment_id: string | null
          reviewed: boolean | null
          reviewed_at: string | null
          reviewed_by: string | null
          service_or_plan_name: string | null
          service_sku: string | null
          status: string | null
          used_by_email: string | null
          used_by_name: string | null
          used_by_user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          coupon_id: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number | null
          id?: string
          order_id?: string | null
          original_amount?: number | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_pix_key?: string | null
          payment_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_or_plan_name?: string | null
          service_sku?: string | null
          status?: string | null
          used_by_email?: string | null
          used_by_name?: string | null
          used_by_user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          coupon_id?: string
          created_at?: string | null
          discount_amount?: number | null
          discount_percent?: number | null
          final_amount?: number | null
          id?: string
          order_id?: string | null
          original_amount?: number | null
          owner_email?: string | null
          owner_id?: string | null
          owner_name?: string | null
          owner_pix_key?: string | null
          payment_id?: string | null
          reviewed?: boolean | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_or_plan_name?: string | null
          service_sku?: string | null
          status?: string | null
          used_by_email?: string | null
          used_by_name?: string | null
          used_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_uses_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "user_coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      manychat_contacts: {
        Row: {
          cpf: string | null
          created_at: string | null
          custom_fields: Json | null
          email: string | null
          first_interaction: string | null
          id: string
          last_interaction: string | null
          name: string | null
          phone: string | null
          subscriber_id: string | null
          tags: Json | null
          updated_at: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_interaction?: string | null
          id?: string
          last_interaction?: string | null
          name?: string | null
          phone?: string | null
          subscriber_id?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string | null
          custom_fields?: Json | null
          email?: string | null
          first_interaction?: string | null
          id?: string
          last_interaction?: string | null
          name?: string | null
          phone?: string | null
          subscriber_id?: string | null
          tags?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number | null
          platform: string | null
          sku: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value?: number | null
          platform?: string | null
          sku?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number | null
          platform?: string | null
          sku?: string | null
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
      password_reset_tokens: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      patient_plans: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          cancelled_at: string | null
          cancelled_reason: string | null
          created_at: string | null
          email: string | null
          id: string
          mp_payer_id: string | null
          mp_subscription_id: string | null
          next_payment_date: string | null
          patient_id: string | null
          payment_method: string | null
          plan_code: string
          plan_expires_at: string | null
          start_date: string | null
          status: string | null
          subscription_status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          mp_payer_id?: string | null
          mp_subscription_id?: string | null
          next_payment_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          plan_code: string
          plan_expires_at?: string | null
          start_date?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          cancelled_at?: string | null
          cancelled_reason?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          mp_payer_id?: string | null
          mp_subscription_id?: string | null
          next_payment_date?: string | null
          patient_id?: string | null
          payment_method?: string | null
          plan_code?: string
          plan_expires_at?: string | null
          start_date?: string | null
          status?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address_line: string | null
          address_number: string | null
          birth_date: string | null
          cep: string | null
          city: string | null
          clicklife_patient_id: string | null
          clicklife_registered_at: string | null
          clubeben_id: string | null
          clubeben_last_sync: string | null
          clubeben_retry_count: number | null
          clubeben_status: string | null
          clubeben_synced_at: string | null
          communicare_patient_id: string | null
          communicare_registered_at: string | null
          complement: string | null
          cpf: string | null
          created_at: string | null
          email: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          manychat_contact_id: string | null
          marketing_opt_in: boolean | null
          neighborhood: string | null
          phone_e164: string | null
          profile_complete: boolean | null
          source: string | null
          state: string | null
          status_email: number | null
          status_sms: number | null
          terms_accepted_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          clicklife_patient_id?: string | null
          clicklife_registered_at?: string | null
          clubeben_id?: string | null
          clubeben_last_sync?: string | null
          clubeben_retry_count?: number | null
          clubeben_status?: string | null
          clubeben_synced_at?: string | null
          communicare_patient_id?: string | null
          communicare_registered_at?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          manychat_contact_id?: string | null
          marketing_opt_in?: boolean | null
          neighborhood?: string | null
          phone_e164?: string | null
          profile_complete?: boolean | null
          source?: string | null
          state?: string | null
          status_email?: number | null
          status_sms?: number | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address_line?: string | null
          address_number?: string | null
          birth_date?: string | null
          cep?: string | null
          city?: string | null
          clicklife_patient_id?: string | null
          clicklife_registered_at?: string | null
          clubeben_id?: string | null
          clubeben_last_sync?: string | null
          clubeben_retry_count?: number | null
          clubeben_status?: string | null
          clubeben_synced_at?: string | null
          communicare_patient_id?: string | null
          communicare_registered_at?: string | null
          complement?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          manychat_contact_id?: string | null
          marketing_opt_in?: boolean | null
          neighborhood?: string | null
          phone_e164?: string | null
          profile_complete?: boolean | null
          source?: string | null
          state?: string | null
          status_email?: number | null
          status_sms?: number | null
          terms_accepted_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pending_employee_invites: {
        Row: {
          accepted_at: string | null
          company_id: string
          completed_at: string | null
          cpf: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          first_name: string | null
          id: string
          invited_at: string | null
          last_name: string | null
          status: string | null
          token: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          completed_at?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_name?: string | null
          status?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          completed_at?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          invited_at?: string | null
          last_name?: string | null
          status?: string | null
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_employee_invites_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_family_invites: {
        Row: {
          accepted_at: string | null
          cpf: string | null
          created_at: string | null
          dependent_patient_id: string | null
          dependent_plan_id: string | null
          email: string
          expires_at: string | null
          first_name: string | null
          id: string
          last_name: string | null
          relationship: string | null
          status: string | null
          titular_patient_id: string
          titular_plan_id: string
          token: string | null
          updated_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          cpf?: string | null
          created_at?: string | null
          dependent_patient_id?: string | null
          dependent_plan_id?: string | null
          email: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          relationship?: string | null
          status?: string | null
          titular_patient_id: string
          titular_plan_id: string
          token?: string | null
          updated_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          cpf?: string | null
          created_at?: string | null
          dependent_patient_id?: string | null
          dependent_plan_id?: string | null
          email?: string
          expires_at?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          relationship?: string | null
          status?: string | null
          titular_patient_id?: string
          titular_plan_id?: string
          token?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pending_family_invites_dependent_patient_id_fkey"
            columns: ["dependent_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_family_invites_dependent_plan_id_fkey"
            columns: ["dependent_plan_id"]
            isOneToOne: false
            referencedRelation: "patient_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_family_invites_titular_patient_id_fkey"
            columns: ["titular_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_family_invites_titular_plan_id_fkey"
            columns: ["titular_plan_id"]
            isOneToOne: false
            referencedRelation: "patient_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_payments: {
        Row: {
          amount: number | null
          amount_original: number | null
          coupon_code: string | null
          coupon_owner_id: string | null
          created_at: string | null
          discount_percent: number | null
          external_reference: string | null
          id: string
          order_id: string | null
          patient_cpf: string | null
          patient_email: string | null
          patient_name: string | null
          payment_data: Json | null
          payment_id: string | null
          payment_method: string | null
          processed: boolean | null
          processed_at: string | null
          purchase_confirmed_event_id: string | null
          purchase_confirmed_sent: boolean | null
          sku: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          amount_original?: number | null
          coupon_code?: string | null
          coupon_owner_id?: string | null
          created_at?: string | null
          discount_percent?: number | null
          external_reference?: string | null
          id?: string
          order_id?: string | null
          patient_cpf?: string | null
          patient_email?: string | null
          patient_name?: string | null
          payment_data?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          processed?: boolean | null
          processed_at?: string | null
          purchase_confirmed_event_id?: string | null
          purchase_confirmed_sent?: boolean | null
          sku?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          amount_original?: number | null
          coupon_code?: string | null
          coupon_owner_id?: string | null
          created_at?: string | null
          discount_percent?: number | null
          external_reference?: string | null
          id?: string
          order_id?: string | null
          patient_cpf?: string | null
          patient_email?: string | null
          patient_name?: string | null
          payment_data?: Json | null
          payment_id?: string | null
          payment_method?: string | null
          processed?: boolean | null
          processed_at?: string | null
          purchase_confirmed_event_id?: string | null
          purchase_confirmed_sent?: boolean | null
          sku?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          allows_recurring: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          price: number | null
          price_cents: number | null
          recurring_frequency: number | null
          recurring_frequency_type: string | null
          sku: string | null
          updated_at: string | null
        }
        Insert: {
          allows_recurring?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          price?: number | null
          price_cents?: number | null
          recurring_frequency?: number | null
          recurring_frequency_type?: string | null
          sku?: string | null
          updated_at?: string | null
        }
        Update: {
          allows_recurring?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number | null
          price_cents?: number | null
          recurring_frequency?: number | null
          recurring_frequency_type?: string | null
          sku?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sso_tokens: {
        Row: {
          clicklife_token: string | null
          created_at: string | null
          expires_at: string
          id: string
          jti: string
          patient_id: string | null
          redirect_to: string | null
          used_at: string | null
        }
        Insert: {
          clicklife_token?: string | null
          created_at?: string | null
          expires_at: string
          id?: string
          jti: string
          patient_id?: string | null
          redirect_to?: string | null
          used_at?: string | null
        }
        Update: {
          clicklife_token?: string | null
          created_at?: string | null
          expires_at?: string
          id?: string
          jti?: string
          patient_id?: string | null
          redirect_to?: string | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sso_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_coupons: {
        Row: {
          allowed_skus: string[] | null
          code: string
          coupon_type: string | null
          created_at: string | null
          discount_percentage: number | null
          id: string
          is_active: boolean | null
          owner_user_id: string | null
          pix_key: string | null
          updated_at: string | null
        }
        Insert: {
          allowed_skus?: string[] | null
          code: string
          coupon_type?: string | null
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          owner_user_id?: string | null
          pix_key?: string | null
          updated_at?: string | null
        }
        Update: {
          allowed_skus?: string[] | null
          code?: string
          coupon_type?: string | null
          created_at?: string | null
          discount_percentage?: number | null
          id?: string
          is_active?: boolean | null
          owner_user_id?: string | null
          pix_key?: string | null
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
      webhook_audit: {
        Row: {
          error_message: string | null
          id: string
          parsed_action: string | null
          parsed_payment_id: string | null
          processing_status: string | null
          processing_time_ms: number | null
          raw_body: string | null
          received_at: string | null
          response_status: number | null
          source: string
        }
        Insert: {
          error_message?: string | null
          id?: string
          parsed_action?: string | null
          parsed_payment_id?: string | null
          processing_status?: string | null
          processing_time_ms?: number | null
          raw_body?: string | null
          received_at?: string | null
          response_status?: number | null
          source?: string
        }
        Update: {
          error_message?: string | null
          id?: string
          parsed_action?: string | null
          parsed_payment_id?: string | null
          processing_status?: string | null
          processing_time_ms?: number | null
          raw_body?: string | null
          received_at?: string | null
          response_status?: number | null
          source?: string
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
      mark_password_changed: { Args: never; Returns: boolean }
      validate_family_invite_token: {
        Args: { _token: string }
        Returns: {
          email: string
          first_name: string
          invite_id: string
          last_name: string
          relationship: string
          titular_patient_id: string
          titular_plan_id: string
        }[]
      }
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
