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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      automations: {
        Row: {
          action_type: string
          active: boolean
          config: Json
          created_at: string
          id: string
          inactive_days: number | null
          message_template: string | null
          name: string
          trigger_type: string
        }
        Insert: {
          action_type: string
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          inactive_days?: number | null
          message_template?: string | null
          name: string
          trigger_type: string
        }
        Update: {
          action_type?: string
          active?: boolean
          config?: Json
          created_at?: string
          id?: string
          inactive_days?: number | null
          message_template?: string | null
          name?: string
          trigger_type?: string
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          email: string | null
          id: string
          lead_id: string | null
          name: string
          notes: string | null
          phone: string | null
          tags: string[] | null
          total_revenue: number
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_revenue?: number
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          lead_id?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "clients_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_webhooks: {
        Row: {
          active: boolean
          created_at: string
          id: string
          page_name: string
          verify_token: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          page_name?: string
          verify_token?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          page_name?: string
          verify_token?: string
        }
        Relationships: []
      }
      interactions: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          lead_id: string | null
          outcome: string | null
          type: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          description: string
          id?: string
          lead_id?: string | null
          outcome?: string | null
          type: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          lead_id?: string | null
          outcome?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_to: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          pipeline_stage: string
          priority: string
          source: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: string
          source?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          pipeline_stage?: string
          priority?: string
          source?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      pipeline_stages: {
        Row: {
          color: string
          id: string
          name: string
          order: number
        }
        Insert: {
          color?: string
          id?: string
          name: string
          order: number
        }
        Update: {
          color?: string
          id?: string
          name?: string
          order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string
          id: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          api_key: string | null
          company_name: string
          id: string
          logo_url: string | null
          webhook_url: string | null
        }
        Insert: {
          api_key?: string | null
          company_name?: string
          id?: string
          logo_url?: string | null
          webhook_url?: string | null
        }
        Update: {
          api_key?: string | null
          company_name?: string
          id?: string
          logo_url?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string
          client_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          id: string
          lead_id: string | null
          priority: string
          status: string
          title: string
        }
        Insert: {
          assigned_to: string
          client_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          id?: string
          lead_id?: string | null
          priority?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
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
      whatsapp_assignments: {
        Row: {
          created_at: string
          id: string
          percentage: number
          user_id: string
          whatsapp_instance_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          percentage?: number
          user_id: string
          whatsapp_instance_id: string
        }
        Update: {
          created_at?: string
          id?: string
          percentage?: number
          user_id?: string
          whatsapp_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_assignments_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_chats: {
        Row: {
          assigned_to: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string | null
          remote_jid: string
          unread_count: number
          whatsapp_instance_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          remote_jid: string
          unread_count?: number
          whatsapp_instance_id: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string | null
          remote_jid?: string
          unread_count?: number
          whatsapp_instance_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_chats_whatsapp_instance_id_fkey"
            columns: ["whatsapp_instance_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          created_at: string
          evolution_api_key: string
          evolution_url: string
          id: string
          instance_name: string
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          evolution_api_key: string
          evolution_url: string
          id?: string
          instance_name: string
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          evolution_api_key?: string
          evolution_url?: string
          id?: string
          instance_name?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          evolution_message_id: string | null
          from_me: boolean
          id: string
          media_url: string | null
          message_type: string
          remote_jid: string
          status: string
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          evolution_message_id?: string | null
          from_me?: boolean
          id?: string
          media_url?: string | null
          message_type?: string
          remote_jid: string
          status?: string
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          evolution_message_id?: string | null
          from_me?: boolean
          id?: string
          media_url?: string | null
          message_type?: string
          remote_jid?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_chats"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_team_members: {
        Args: never
        Returns: {
          full_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "salesperson"
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
      app_role: ["admin", "manager", "salesperson"],
    },
  },
} as const
