export type DifficultyLabel = "beginner" | "intermediate" | "expert";
export type LogLevel = "info" | "warn" | "error";

export interface SourceRow {
  id: string;
  name: string;
  listing_url: string;
  parser_strategy: string | null;
  is_active: boolean;
  logo_url: string | null;
  created_at: string;
}

export interface SourceInsert {
  name: string;
  listing_url: string;
  parser_strategy?: string | null;
  is_active?: boolean;
  logo_url?: string | null;
}

export interface PaperRow {
  id: string;
  source_id: string;
  original_url: string;
  canonical_url: string | null;
  title: string;
  image_url: string | null;
  published_at: string;
  raw_text: string;
  scraped_at: string;
  analyzed_at: string | null;
  created_at: string;
}

export interface PaperInsert {
  source_id: string;
  original_url: string;
  canonical_url?: string | null;
  title: string;
  image_url?: string | null;
  published_at: string;
  raw_text: string;
  analyzed_at?: string | null;
}

export interface PaperAnalysisRow {
  id: string;
  paper_id: string;
  neutral_summary: string;
  technical_difficulty_score: number;
  difficulty_label: DifficultyLabel;
  core_methodology: string;
  key_takeaways: [string, string, string];
  confidence: number;
  disclaimer: string;
  model_name: string;
  primary_category: string;
  prerequisites: string[] | null;
  embedding: number[] | null;
  created_at: string;
}

export interface PaperAnalysisInsert {
  paper_id: string;
  neutral_summary: string;
  technical_difficulty_score: number;
  difficulty_label: DifficultyLabel;
  core_methodology: string;
  key_takeaways: [string, string, string];
  confidence: number;
  disclaimer: string;
  model_name: string;
  primary_category: string;
  prerequisites?: string[] | null;
  embedding?: number[] | null;
}

export interface LogRow {
  id: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

export interface OxylabsScheduleRow {
  id: string;
  source_id: string;
  oxylabs_schedule_id: string;
  cron_expression: string;
  is_active: boolean;
  created_at: string;
}

export interface OxylabsScheduleInsert {
  source_id: string;
  oxylabs_schedule_id: string;
  cron_expression: string;
  is_active?: boolean;
}

export interface OxylabsScheduleRunRow {
  id: string;
  schedule_id: string;
  oxylabs_run_id: string;
  oxylabs_job_id: string | null;
  result_status: string;
  processed_at: string | null;
  created_at: string;
}

export interface OxylabsScheduleRunInsert {
  schedule_id: string;
  oxylabs_run_id: string;
  oxylabs_job_id?: string | null;
  result_status: string;
  processed_at?: string | null;
}

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: "13";
  };
  public: {
    Tables: {
      sources: {
        Row: SourceRow;
        Insert: SourceInsert;
        Update: Partial<SourceInsert>;
        Relationships: [];
      };
      papers: {
        Row: PaperRow;
        Insert: PaperInsert;
        Update: Partial<PaperInsert>;
        Relationships: [
          {
            foreignKeyName: "papers_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      paper_analyses: {
        Row: PaperAnalysisRow;
        Insert: PaperAnalysisInsert;
        Update: Partial<PaperAnalysisInsert>;
        Relationships: [
          {
            foreignKeyName: "paper_analyses_paper_id_fkey";
            columns: ["paper_id"];
            isOneToOne: true;
            referencedRelation: "papers";
            referencedColumns: ["id"];
          },
        ];
      };
      logs: {
        Row: LogRow;
        Insert: Omit<LogRow, "id" | "created_at">;
        Update: Partial<Omit<LogRow, "id" | "created_at">>;
        Relationships: [];
      };
      oxylabs_schedules: {
        Row: OxylabsScheduleRow;
        Insert: OxylabsScheduleInsert;
        Update: Partial<OxylabsScheduleInsert>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedules_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: true;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      oxylabs_schedule_runs: {
        Row: OxylabsScheduleRunRow;
        Insert: OxylabsScheduleRunInsert;
        Update: Partial<OxylabsScheduleRunInsert>;
        Relationships: [
          {
            foreignKeyName: "oxylabs_schedule_runs_schedule_id_fkey";
            columns: ["schedule_id"];
            isOneToOne: false;
            referencedRelation: "oxylabs_schedules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      match_related_papers: {
        Args: {
          query_embedding: number[];
          match_paper_id: string;
          match_count: number;
        };
        Returns: { paper_id: string; distance: number }[];
      };
    };
  };
}
