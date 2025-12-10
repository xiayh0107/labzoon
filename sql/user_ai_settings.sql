CREATE TABLE IF NOT EXISTS user_ai_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT,
  api_key TEXT,
  base_url TEXT,
  text_model TEXT,
  image_model TEXT,
  temperature NUMERIC,
  top_p NUMERIC,
  top_k INTEGER,
  max_output_tokens INTEGER,
  system_prompt_text TEXT,
  system_prompt_image TEXT,
  system_prompt_structure TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_ai_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own ai settings" ON user_ai_settings;
CREATE POLICY "Users can read own ai settings" ON user_ai_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert own ai settings" ON user_ai_settings;
CREATE POLICY "Users can upsert own ai settings" ON user_ai_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own ai settings" ON user_ai_settings;
CREATE POLICY "Users can update own ai settings" ON user_ai_settings FOR UPDATE USING (auth.uid() = user_id);
