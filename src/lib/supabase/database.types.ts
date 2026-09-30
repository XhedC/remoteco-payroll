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
      company_settings: {
        Row: {
          company_name: string
          currency: string
          default_deduction_rate: number
          id: number
          minimum_paid_ot_minutes: number
          notify_on_missed_clock_out: boolean
          notify_on_payroll_run: boolean
          overtime_multiplier: number
          overtime_threshold_hours: number
          pay_frequency: string
          require_geo_clock_in: boolean
          standard_work_hours: number
          timezone: string
          unpaid_early_clockin_minutes: number
        }
        Insert: {
          company_name?: string
          currency?: string
          default_deduction_rate?: number
          id?: number
          minimum_paid_ot_minutes?: number
          notify_on_missed_clock_out?: boolean
          notify_on_payroll_run?: boolean
          overtime_multiplier?: number
          overtime_threshold_hours?: number
          pay_frequency?: string
          require_geo_clock_in?: boolean
          standard_work_hours?: number
          timezone?: string
          unpaid_early_clockin_minutes?: number
        }
        Update: {
          company_name?: string
          currency?: string
          default_deduction_rate?: number
          id?: number
          minimum_paid_ot_minutes?: number
          notify_on_missed_clock_out?: boolean
          notify_on_payroll_run?: boolean
          overtime_multiplier?: number
          overtime_threshold_hours?: number
          pay_frequency?: string
          require_geo_clock_in?: boolean
          standard_work_hours?: number
          timezone?: string
          unpaid_early_clockin_minutes?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string
          email: string
          hourly_rate: number
          id: string
          joined_at: string
          name: string
          phone: string | null
          role: Database["public"]["Enums"]["employee_role"]
          schedule_in: string | null
          schedule_out: string | null
          status: Database["public"]["Enums"]["employee_status"]
          title: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string
          email: string
          hourly_rate?: number
          id: string
          joined_at?: string
          name: string
          phone?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          schedule_in?: string | null
          schedule_out?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          title?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string
          email?: string
          hourly_rate?: number
          id?: string
          joined_at?: string
          name?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["employee_role"]
          schedule_in?: string | null
          schedule_out?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          title?: string
        }
        Relationships: []
      }
      owner_secret: {
        Row: {
          id: number
          password_hash: string
        }
        Insert: {
          id?: number
          password_hash: string
        }
        Update: {
          id?: number
          password_hash?: string
        }
        Relationships: []
      }
      payroll_lines: {
        Row: {
          addition: number
          adjustment: number
          employee_id: string
          gross_pay: number
          hourly_rate: number
          id: string
          net_pay: number
          overtime_approved: boolean
          overtime_hours: number
          payroll_run_id: string
          regular_hours: number
          status: Database["public"]["Enums"]["pay_period_status"]
        }
        Insert: {
          addition?: number
          adjustment?: number
          employee_id: string
          gross_pay?: number
          hourly_rate?: number
          id?: string
          net_pay?: number
          overtime_approved?: boolean
          overtime_hours?: number
          payroll_run_id: string
          regular_hours?: number
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Update: {
          addition?: number
          adjustment?: number
          employee_id?: string
          gross_pay?: number
          hourly_rate?: number
          id?: string
          net_pay?: number
          overtime_approved?: boolean
          overtime_hours?: number
          payroll_run_id?: string
          regular_hours?: number
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payroll_lines_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_lines_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          created_at: string
          id: string
          paid_at: string | null
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["pay_period_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Update: {
          created_at?: string
          id?: string
          paid_at?: string | null
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["pay_period_status"]
        }
        Relationships: []
      }
      payslip_confirmations: {
        Row: {
          confirmed_at: string | null
          employee_id: string
          id: string
          net_pay: number
          payroll_run_id: string
          period_end: string
          period_start: string
          sent_at: string
        }
        Insert: {
          confirmed_at?: string | null
          employee_id: string
          id?: string
          net_pay: number
          payroll_run_id: string
          period_end: string
          period_start: string
          sent_at?: string
        }
        Update: {
          confirmed_at?: string | null
          employee_id?: string
          id?: string
          net_pay?: number
          payroll_run_id?: string
          period_end?: string
          period_start?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslip_confirmations_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslip_confirmations_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      screen_logs: {
        Row: {
          action: Database["public"]["Enums"]["screen_log_action"]
          detail: string
          device: string | null
          employee_id: string
          id: string
          ip: string | null
          timestamp: string
        }
        Insert: {
          action: Database["public"]["Enums"]["screen_log_action"]
          detail?: string
          device?: string | null
          employee_id: string
          id?: string
          ip?: string | null
          timestamp?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["screen_log_action"]
          detail?: string
          device?: string | null
          employee_id?: string
          id?: string
          ip?: string | null
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_logs_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      screenshots: {
        Row: {
          captured_at: string
          employee_id: string
          id: string
          storage_path: string
          time_entry_id: string | null
        }
        Insert: {
          captured_at?: string
          employee_id: string
          id?: string
          storage_path: string
          time_entry_id?: string | null
        }
        Update: {
          captured_at?: string
          employee_id?: string
          id?: string
          storage_path?: string
          time_entry_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screenshots_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenshots_time_entry_id_fkey"
            columns: ["time_entry_id"]
            isOneToOne: false
            referencedRelation: "time_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          clock_in: string
          clock_out: string | null
          created_at: string
          employee_id: string
          id: string
          note: string | null
        }
        Insert: {
          clock_in: string
          clock_out?: string | null
          created_at?: string
          employee_id: string
          id?: string
          note?: string | null
        }
        Update: {
          clock_in?: string
          clock_out?: string | null
          created_at?: string
          employee_id?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      verify_owner_password: { Args: { password: string }; Returns: boolean }
    }
    Enums: {
      employee_role: "Admin" | "Manager" | "Consultant" | "Staff" | "Other"
      employee_status: "Active" | "On Leave" | "Inactive"
      pay_period_status: "Pending" | "On Processing" | "Paid" | "Unpaid"
      screen_log_action:
        | "Login"
        | "Logout"
        | "Clock In"
        | "Clock Out"
        | "Page View"
        | "Settings Change"
        | "Payroll Run"
        | "Failed Login"
        | "Payslip Email"
        | "Idle"
        | "Active"
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
      employee_role: ["Admin", "Manager", "Consultant", "Staff", "Other"],
      employee_status: ["Active", "On Leave", "Inactive"],
      pay_period_status: ["Pending", "On Processing", "Paid", "Unpaid"],
      screen_log_action: [
        "Login",
        "Logout",
        "Clock In",
        "Clock Out",
        "Page View",
        "Settings Change",
        "Payroll Run",
        "Failed Login",
        "Payslip Email",
        "Idle",
        "Active",
      ],
    },
  },
} as const
