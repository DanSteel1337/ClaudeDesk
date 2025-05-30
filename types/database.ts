export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_settings: {
        Row: {
          id: string
          user_id: string
          anthropic_api_key: string | null
          preferred_model: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          anthropic_api_key?: string | null
          preferred_model?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          anthropic_api_key?: string | null
          preferred_model?: string
          created_at?: string
          updated_at?: string
        }
      }
      documents: {
        Row: {
          id: string
          user_id: string
          project_id: string // Added
          name: string
          file_url: string | null
          file_size: number | null
          mime_type: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string // Added
          name: string
          file_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string // Added
          name?: string
          file_url?: string | null
          file_size?: number | null
          mime_type?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      document_chunks: {
        Row: {
          id: string
          document_id: string
          user_id: string
          project_id: string // Added
          content: string
          context: string | null
          embedding: number[] | null // In DB it's `vector`, TS type is `number[]`
          chunk_index: number | null
          tokens: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
          project_id: string // Added
          content: string
          context?: string | null
          embedding?: number[] | null
          chunk_index?: number | null
          tokens?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          document_id?: string
          user_id?: string
          project_id?: string // Added
          content?: string
          context?: string | null
          embedding?: number[] | null
          chunk_index?: number | null
          tokens?: number | null
          created_at?: string
        }
      }
      chat_threads: {
        // Renamed from conversations
        Row: {
          id: string
          user_id: string
          project_id: string // Added
          title: string | null
          model: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          project_id: string // Added
          title?: string | null
          model?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          project_id?: string // Added
          title?: string | null
          model?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chat_thread_id: string // Renamed
          role: string
          content: string
          tokens_used: number
          created_at: string
        }
        Insert: {
          id?: string
          chat_thread_id: string // Renamed
          role: string
          content: string
          tokens_used?: number
          created_at?: string
        }
        Update: {
          id?: string
          chat_thread_id?: string // Renamed
          role?: string
          content?: string
          tokens_used?: number
          created_at?: string
        }
      }
    }
    Functions: {
      // For the match_document_chunks function
      match_document_chunks: {
        Args: {
          query_embedding: number[]
          match_threshold: number
          match_count: number
          filter_user_id: string
          filter_project_id: string // Added
        }
        Returns: {
          // Define the structure of the returned rows
          id: string
          document_id: string
          content: string
          context: string | null
          similarity: number
        }[]
      }
    }
  }
}

export type Project = Database["public"]["Tables"]["projects"]["Row"]
export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"]
export type Document = Database["public"]["Tables"]["documents"]["Row"]
export type DocumentChunk = Database["public"]["Tables"]["document_chunks"]["Row"]
export type ChatThread = Database["public"]["Tables"]["chat_threads"]["Row"] // Renamed
export type Message = Database["public"]["Tables"]["messages"]["Row"]
