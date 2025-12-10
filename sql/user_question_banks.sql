-- ============================================
-- 用户私人题库表结构
-- 让每个用户都能创建和管理自己的题库
-- ============================================

-- 1. 用户题库表 (User Question Banks)
CREATE TABLE IF NOT EXISTS user_question_banks (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'blue',
    icon TEXT DEFAULT '📚',
    is_public BOOLEAN DEFAULT FALSE, -- 是否公开（未来扩展：分享题库）
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户题库章节表 (User Bank Sections)
CREATE TABLE IF NOT EXISTS user_bank_sections (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES user_question_banks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 用户题库题目表 (User Bank Challenges)
CREATE TABLE IF NOT EXISTS user_bank_challenges (
    id TEXT PRIMARY KEY,
    section_id TEXT NOT NULL REFERENCES user_bank_sections(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    options JSONB, -- 选项数组 [{"id": "A", "text": "选项1"}, ...]
    explanation TEXT, -- 解析
    image_url TEXT, -- 图片 URL 或 base64
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 用户题库练习进度表
CREATE TABLE IF NOT EXISTS user_bank_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bank_id TEXT NOT NULL REFERENCES user_question_banks(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL REFERENCES user_bank_sections(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    stars INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    total_count INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, section_id)
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_banks_user_id ON user_question_banks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_bank_sections_bank_id ON user_bank_sections(bank_id);
CREATE INDEX IF NOT EXISTS idx_user_bank_challenges_section_id ON user_bank_challenges(section_id);
CREATE INDEX IF NOT EXISTS idx_user_bank_progress_user_id ON user_bank_progress(user_id);

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
DROP TRIGGER IF EXISTS update_user_banks_updated_at ON user_question_banks;
CREATE TRIGGER update_user_banks_updated_at
    BEFORE UPDATE ON user_question_banks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_bank_sections_updated_at ON user_bank_sections;
CREATE TRIGGER update_user_bank_sections_updated_at
    BEFORE UPDATE ON user_bank_sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_bank_challenges_updated_at ON user_bank_challenges;
CREATE TRIGGER update_user_bank_challenges_updated_at
    BEFORE UPDATE ON user_bank_challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS 策略 (Row Level Security)
-- ============================================

-- User Question Banks: 用户只能读写自己的题库
ALTER TABLE user_question_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own banks" ON user_question_banks;
CREATE POLICY "Users can read own banks" ON user_question_banks 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own banks" ON user_question_banks;
CREATE POLICY "Users can insert own banks" ON user_question_banks 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own banks" ON user_question_banks;
CREATE POLICY "Users can update own banks" ON user_question_banks 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own banks" ON user_question_banks;
CREATE POLICY "Users can delete own banks" ON user_question_banks 
    FOR DELETE USING (auth.uid() = user_id);

-- 服务端完全访问
DROP POLICY IF EXISTS "Service role full access user banks" ON user_question_banks;
CREATE POLICY "Service role full access user banks" ON user_question_banks FOR ALL USING (true);

-- User Bank Sections: 通过 bank_id 关联到用户
ALTER TABLE user_bank_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own sections" ON user_bank_sections;
CREATE POLICY "Users can manage own sections" ON user_bank_sections 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_question_banks 
            WHERE id = user_bank_sections.bank_id 
            AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access sections" ON user_bank_sections;
CREATE POLICY "Service role full access sections" ON user_bank_sections FOR ALL USING (true);

-- User Bank Challenges: 通过 section_id -> bank_id 关联到用户
ALTER TABLE user_bank_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own challenges" ON user_bank_challenges;
CREATE POLICY "Users can manage own challenges" ON user_bank_challenges 
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_bank_sections s
            JOIN user_question_banks b ON s.bank_id = b.id
            WHERE s.id = user_bank_challenges.section_id 
            AND b.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role full access bank challenges" ON user_bank_challenges;
CREATE POLICY "Service role full access bank challenges" ON user_bank_challenges FOR ALL USING (true);

-- User Bank Progress: 用户只能读写自己的进度
ALTER TABLE user_bank_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own bank progress" ON user_bank_progress;
CREATE POLICY "Users can read own bank progress" ON user_bank_progress 
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own bank progress" ON user_bank_progress;
CREATE POLICY "Users can insert own bank progress" ON user_bank_progress 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bank progress" ON user_bank_progress;
CREATE POLICY "Users can update own bank progress" ON user_bank_progress 
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role full access bank progress" ON user_bank_progress;
CREATE POLICY "Service role full access bank progress" ON user_bank_progress FOR ALL USING (true);

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE user_question_banks IS '用户私人题库';
COMMENT ON TABLE user_bank_sections IS '用户题库章节';
COMMENT ON TABLE user_bank_challenges IS '用户题库题目';
COMMENT ON TABLE user_bank_progress IS '用户题库练习进度';
