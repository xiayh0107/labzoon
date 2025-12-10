CREATE TABLE IF NOT EXISTS user_knowledge_base (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  content TEXT,
  type TEXT,
  image_data TEXT,
  tags JSONB,
  created_at BIGINT,
  updated_at BIGINT
);

ALTER TABLE user_knowledge_base ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own user_knowledge_base" ON user_knowledge_base;
CREATE POLICY "Users can read own user_knowledge_base" ON user_knowledge_base FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own user_knowledge_base" ON user_knowledge_base;
CREATE POLICY "Users can insert own user_knowledge_base" ON user_knowledge_base FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own user_knowledge_base" ON user_knowledge_base;
CREATE POLICY "Users can update own user_knowledge_base" ON user_knowledge_base FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own user_knowledge_base" ON user_knowledge_base;
CREATE POLICY "Users can delete own user_knowledge_base" ON user_knowledge_base FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_kb_user ON user_knowledge_base(user_id);
CREATE INDEX IF NOT EXISTS idx_user_kb_created_at ON user_knowledge_base(created_at DESC);
