export interface Database {
  public: {
    Tables: {
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
          content: string
          context: string | null
          embedding: number[] | null
          chunk_index: number | null
          tokens: number | null
          created_at: string
        }
        Insert: {
          id?: string
          document_id: string
          user_id: string
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
          content?: string
          context?: string | null
          embedding?: number[] | null
          chunk_index?: number | null
          tokens?: number | null
          created_at?: string
        }
      }
      conversations: {
        Row: {
          id: string
          user_id: string
          title: string | null
          model: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          model?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          model?: string
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          role: string
          content: string
          tokens_used: number
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          role: string
          content: string
          tokens_used?: number
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          role?: string
          content?: string
          tokens_used?: number
          created_at?: string
        }
      }
    }
  }
}

export type UserSettings = Database["public"]["Tables"]["user_settings"]["Row"]
export type Document = Database["public"]["Tables"]["documents"]["Row"]
export type DocumentChunk = Database["public"]["Tables"]["document_chunks"]["Row"]
export type Conversation = Database["public"]["Tables"]["conversations"]["Row"]
export type Message = Database["public"]["Tables"]["messages"]["Row"]
