-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  anthropic_api_key TEXT, -- Client-side encrypted
  preferred_model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Documents table for uploaded files
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL, -- Added project_id
  name TEXT NOT NULL,
  file_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('processing', 'completed', 'failed', 'pending')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL, -- Added project_id
  content TEXT NOT NULL,
  context TEXT, 
  embedding vector(1536), 
  chunk_index INTEGER,
  tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Threads table (renamed from conversations)
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL, -- Added project_id
  title TEXT,
  model TEXT DEFAULT 'claude-3-5-sonnet-20241022',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_thread_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE NOT NULL, -- Renamed conversation_id
  -- user_id could be added here if needed for direct message RLS, but chat_thread ownership should cover it
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects(user_id);
CREATE INDEX IF NOT EXISTS documents_project_id_idx ON documents(project_id);
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_project_id_idx ON document_chunks(project_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS chat_threads_project_id_idx ON chat_threads(project_id);
CREATE INDEX IF NOT EXISTS chat_threads_user_id_idx ON chat_threads(user_id);
CREATE INDEX IF NOT EXISTS messages_chat_thread_id_idx ON messages(chat_thread_id);
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx ON document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 24, ef_construction = 100);

-- Enable Row Level Security
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users own their settings" ON user_settings;
CREATE POLICY "Users own their settings" ON user_settings
  FOR ALL USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage documents in their projects" ON documents;
CREATE POLICY "Users can manage documents in their projects" ON documents
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage chunks in their projects" ON document_chunks;
CREATE POLICY "Users can manage chunks in their projects" ON document_chunks
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage chat threads in their projects" ON chat_threads;
CREATE POLICY "Users can manage chat threads in their projects" ON chat_threads
  FOR ALL USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage messages in their chat threads" ON messages;
CREATE POLICY "Users can manage messages in their chat threads" ON messages
  FOR ALL USING (chat_thread_id IN (SELECT id FROM chat_threads WHERE user_id = auth.uid()));


-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating timestamps
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON chat_threads;
CREATE TRIGGER update_chat_threads_updated_at BEFORE UPDATE ON chat_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function for vector similarity search (scoped by project_id)
CREATE OR REPLACE FUNCTION match_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_user_id uuid,
  filter_project_id uuid -- Added project_id filter
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  context text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.document_id,
    dc.content,
    dc.context,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM
    document_chunks dc
  WHERE 
    dc.user_id = filter_user_id AND 
    dc.project_id = filter_project_id AND -- Scope by project
    1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY
    similarity DESC
  LIMIT match_count;
END;
$$;
