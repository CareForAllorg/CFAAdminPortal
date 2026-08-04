// Hand-written bootstrap in the same shape `supabase gen types typescript`
// produces, so the rest of the codebase can depend on `Database` today.
// This file is meant to be OVERWRITTEN by running `npm run gen:types`
// against the real, linked project (see that script in package.json) --
// do it once `supabase link` has been run locally, then commit the diff.
// Until then, this reflects the schema as observed from actual
// .select()/.update()/.upsert() call sites across the app, including the
// service_logs -> profiles foreign key added in
// 20260706000002_service_logs_profiles_fk.sql.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      chapters: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          project_count_override: number | null;
          status: string;
          meta: Json | null;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          project_count_override?: number | null;
          status?: string;
          meta?: Json | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          project_count_override?: number | null;
          status?: string;
          meta?: Json | null;
        };
        Relationships: [];
      };
      // NextAuth-style identity table -- profiles.id and service_logs.user_id
      // both reference this table's id (see the FK inspection findings in
      // 20260707000002's comments), not the other way around.
      users: {
        Row: {
          id: string;
          name: string | null;
          email: string | null;
          emailVerified: string | null;
          image: string | null;
        };
        Insert: {
          id: string;
          name?: string | null;
          email?: string | null;
          emailVerified?: string | null;
          image?: string | null;
        };
        Update: {
          id?: string;
          name?: string | null;
          email?: string | null;
          emailVerified?: string | null;
          image?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          first_name: string | null;
          last_name: string | null;
          role: string;
          gender: string | null;
          education_level: string | null;
          date_of_birth: string | null;
          location: string | null;
          chapter_id: string | null;
          created_at: string;
          interests: string[] | null;
          referral_source: string | null;
          co_lead_info: string | null;
          over_18: boolean | null;
          chapter_type: string | null;
          chapter_location: string | null;
          chapter_name: string | null;
          advisor_name: string | null;
          advisor_email: string | null;
          partner_organization: string | null;
          agreed_general_participation: boolean | null;
          agreed_media_release: boolean | null;
        };
        Insert: {
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          role: string;
          gender?: string | null;
          education_level?: string | null;
          date_of_birth?: string | null;
          location?: string | null;
          chapter_id?: string | null;
          created_at?: string;
          interests?: string[] | null;
          referral_source?: string | null;
          co_lead_info?: string | null;
          over_18?: boolean | null;
          chapter_type?: string | null;
          chapter_location?: string | null;
          chapter_name?: string | null;
          advisor_name?: string | null;
          advisor_email?: string | null;
          partner_organization?: string | null;
          agreed_general_participation?: boolean | null;
          agreed_media_release?: boolean | null;
        };
        Update: {
          id?: string;
          first_name?: string | null;
          last_name?: string | null;
          role?: string;
          gender?: string | null;
          education_level?: string | null;
          date_of_birth?: string | null;
          location?: string | null;
          chapter_id?: string | null;
          created_at?: string;
          interests?: string[] | null;
          referral_source?: string | null;
          co_lead_info?: string | null;
          over_18?: boolean | null;
          chapter_type?: string | null;
          chapter_location?: string | null;
          chapter_name?: string | null;
          advisor_name?: string | null;
          advisor_email?: string | null;
          partner_organization?: string | null;
          agreed_general_participation?: boolean | null;
          agreed_media_release?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_chapter_id_fkey';
            columns: ['chapter_id'];
            isOneToOne: false;
            referencedRelation: 'chapters';
            referencedColumns: ['id'];
          },
        ];
      };
      chapter_checkins: {
        Row: {
          id: string;
          chapter_name: string;
          quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
          activities: string | null;
          member_count: number | null;
          challenges: string | null;
          submitted_at: string | null;
          user_id: string;
        };
        Insert: {
          id?: string;
          chapter_name: string;
          quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4';
          activities?: string | null;
          member_count?: number | null;
          challenges?: string | null;
          submitted_at?: string | null;
          user_id: string;
        };
        Update: {
          id?: string;
          chapter_name?: string;
          quarter?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
          activities?: string | null;
          member_count?: number | null;
          challenges?: string | null;
          submitted_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      checkin_deadlines: {
        Row: {
          year: number;
          q1: string | null;
          q2: string | null;
          q3: string | null;
          q4: string | null;
          updated_at: string;
        };
        Insert: {
          year: number;
          q1?: string | null;
          q2?: string | null;
          q3?: string | null;
          q4?: string | null;
          updated_at?: string;
        };
        Update: {
          year?: number;
          q1?: string | null;
          q2?: string | null;
          q3?: string | null;
          q4?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_logs: {
        Row: {
          id: string;
          user_id: string | null;
          name: string | null;
          email: string | null;
          org_name: string | null;
          activity_type: string;
          hours: number;
          status: 'pending' | 'approved' | 'rejected';
          description: string | null;
          rejection_reason: string | null;
          submitted_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          verify_method: string | null;
          verification_completed: boolean;
          verification_completed_at: string | null;
          primary_impact: string | null;
          impact_magnitude: number | null;
          secondary_impact: string | null;
          secondary_impact_magnitude: number | null;
          proof_path: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          org_name?: string | null;
          activity_type: string;
          hours: number;
          status?: 'pending' | 'approved' | 'rejected';
          description?: string | null;
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          verify_method?: string | null;
          verification_completed?: boolean;
          verification_completed_at?: string | null;
          primary_impact?: string | null;
          impact_magnitude?: number | null;
          secondary_impact?: string | null;
          secondary_impact_magnitude?: number | null;
          proof_path?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          name?: string | null;
          email?: string | null;
          org_name?: string | null;
          activity_type?: string;
          hours?: number;
          status?: 'pending' | 'approved' | 'rejected';
          description?: string | null;
          rejection_reason?: string | null;
          submitted_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          verify_method?: string | null;
          verification_completed?: boolean;
          verification_completed_at?: string | null;
          primary_impact?: string | null;
          impact_magnitude?: number | null;
          secondary_impact?: string | null;
          secondary_impact_magnitude?: number | null;
          proof_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'service_logs_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      service_log_contributions: {
        Row: {
          id: string;
          service_log_id: string;
          name: string | null;
          email: string | null;
          hours: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_log_id: string;
          name?: string | null;
          email?: string | null;
          hours: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_log_id?: string;
          name?: string | null;
          email?: string | null;
          hours?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_log_contributions_service_log_id_fkey';
            columns: ['service_log_id'];
            isOneToOne: false;
            referencedRelation: 'service_logs';
            referencedColumns: ['id'];
          },
        ];
      };
      resources: {
        Row: {
          id: string;
          category: 'Handbooks' | 'Toolkits' | 'Videos' | 'Other';
          title: string;
          description: string | null;
          link: string | null;
          source_type: string | null;
          duration: string | null;
          audience: string | null;
          status: 'published' | 'coming-soon';
          updated_at: string;
        };
        Insert: {
          id?: string;
          category: 'Handbooks' | 'Toolkits' | 'Videos' | 'Other';
          title: string;
          description?: string | null;
          link?: string | null;
          source_type?: string | null;
          duration?: string | null;
          audience?: string | null;
          status?: 'published' | 'coming-soon';
          updated_at?: string;
        };
        Update: {
          id?: string;
          category?: 'Handbooks' | 'Toolkits' | 'Videos' | 'Other';
          title?: string;
          description?: string | null;
          link?: string | null;
          source_type?: string | null;
          duration?: string | null;
          audience?: string | null;
          status?: 'published' | 'coming-soon';
          updated_at?: string;
        };
        Relationships: [];
      };
      // Drives the Project Directory carousel on the member-facing app's
      // Mapping page (see VolunteerPortalCFA's app/api/mapping/projects).
      mapping_projects: {
        Row: {
          id: string;
          region: string;
          country: string;
          types: string[];
          url: string | null;
          color: string;
          description: string;
          mapping_level: string | null;
          featured: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          region: string;
          country: string;
          types?: string[];
          url?: string | null;
          color?: string;
          description: string;
          mapping_level?: string | null;
          featured?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          region?: string;
          country?: string;
          types?: string[];
          url?: string | null;
          color?: string;
          description?: string;
          mapping_level?: string | null;
          featured?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      // A chapter lead's "I hosted this event" record -- see
      // VolunteerPortalCFA's POST /api/mapping/mapathon-reports. Distinct
      // from mapathon time-log service_logs rows.
      mapathon_reports: {
        Row: {
          id: string;
          user_id: string;
          chapter_id: string | null;
          event_date: string;
          setting: string;
          participants: number;
          tasks_completed: number;
          notes: string | null;
          proof_path: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          chapter_id?: string | null;
          event_date: string;
          setting: string;
          participants?: number;
          tasks_completed?: number;
          notes?: string | null;
          proof_path?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          chapter_id?: string | null;
          event_date?: string;
          setting?: string;
          participants?: number;
          tasks_completed?: number;
          notes?: string | null;
          proof_path?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // No member-facing signup form for these -- staff add them by hand
      // (see api/_handlers/partners.ts).
      partners: {
        Row: {
          id: string;
          name: string;
          website: string | null;
          contact_name: string | null;
          contact_email: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          website?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          website?: string | null;
          contact_name?: string | null;
          contact_email?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      // Project Hub submissions on the member-facing app (start-a-project
      // wizard + wrap-up activity summary). See VolunteerPortalCFA's
      // app/api/projects.
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: string;
          scope: string;
          deadline: string | null;
          status: string;
          prep: boolean;
          impl: boolean;
          wrapup: boolean;
          data: Json | null;
          chapter_id: string | null;
          contributor_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type: string;
          scope?: string;
          deadline?: string | null;
          status?: string;
          prep?: boolean;
          impl?: boolean;
          wrapup?: boolean;
          data?: Json | null;
          chapter_id?: string | null;
          contributor_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: string;
          scope?: string;
          deadline?: string | null;
          status?: string;
          prep?: boolean;
          impl?: boolean;
          wrapup?: boolean;
          data?: Json | null;
          chapter_id?: string | null;
          contributor_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      mentors: {
        Row: {
          id: string;
          name: string;
          calendly_link: string | null;
          available: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          calendly_link?: string | null;
          available?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          calendly_link?: string | null;
          available?: boolean;
        };
        Relationships: [];
      };
      mentorship_sessions: {
        Row: {
          id: string;
        };
        Insert: {
          id?: string;
        };
        Update: {
          id?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
