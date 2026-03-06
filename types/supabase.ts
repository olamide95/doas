export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          avatar_url: string | null
          role: string
          department: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string
          avatar_url?: string | null
          role?: string
          department?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          avatar_url?: string | null
          role?: string
          department?: string
          created_at?: string
          updated_at?: string
        }
      }
      submissions: {
        Row: {
          id: string
          title: string
          description: string
          status: string
          submitter_id: string
          assigned_to: string | null
          document_url: string | null
          created_at: string
          updated_at: string
          department: string
          priority: string
        }
        Insert: {
          id?: string
          title: string
          description: string
          status?: string
          submitter_id: string
          assigned_to?: string | null
          document_url?: string | null
          created_at?: string
          updated_at?: string
          department: string
          priority?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string
          status?: string
          submitter_id?: string
          assigned_to?: string | null
          document_url?: string | null
          created_at?: string
          updated_at?: string
          department?: string
          priority?: string
        }
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          is_completed: boolean
          user_id: string
          created_at: string
          due_date: string | null
          priority: string
          related_submission_id: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          is_completed?: boolean
          user_id: string
          created_at?: string
          due_date?: string | null
          priority?: string
          related_submission_id?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          is_completed?: boolean
          user_id?: string
          created_at?: string
          due_date?: string | null
          priority?: string
          related_submission_id?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          content: string
          is_read: boolean
          created_at: string
          type: string
          reference_id: string | null
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          is_read?: boolean
          created_at?: string
          type: string
          reference_id?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          is_read?: boolean
          created_at?: string
          type?: string
          reference_id?: string | null
        }
      }
      chat_messages: {
        Row: {
          id: string
          sender_id: string
          content: string
          created_at: string
          chat_room_id: string
          attachment_url: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          content: string
          created_at?: string
          chat_room_id: string
          attachment_url?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          content?: string
          created_at?: string
          chat_room_id?: string
          attachment_url?: string | null
        }
      }
      chat_rooms: {
        Row: {
          id: string
          name: string
          is_department: boolean
          department: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          is_department?: boolean
          department?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          is_department?: boolean
          department?: string | null
          created_at?: string
        }
      }
      chat_room_members: {
        Row: {
          chat_room_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          chat_room_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          chat_room_id?: string
          user_id?: string
          joined_at?: string
        }
      }
    }
  }
}
