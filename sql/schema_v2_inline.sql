-- LabZoon Database Schema v2
-- 运行此脚本初始化数据库

-- 1. 单元表 (Units)
CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'blue',
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 课程表 (Lessons)
CREATE TABLE IF NOT EXISTS lessons (
    id TEXT PRIMARY KEY,
    unit_id TEXT NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 挑战表 (Challenges)
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'fill_blank')),
    question TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 用户进度表 (User Progress)
CREATE TABLE IF NOT EXISTS user_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    stars INTEGER DEFAULT 0 CHECK (stars BETWEEN 0 AND 3),
    attempts INTEGER DEFAULT 0,
    last_attempt TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, lesson_id)
);

-- 5. 知识点表 (Knowledge Items)
CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT REFERENCES lessons(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text' CHECK (type IN ('text', 'image', 'video')),
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 管理员表 (Admins)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 用户私人题库表 (User Question Banks)
CREATE TABLE IF NOT EXISTS user_question_banks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 用户私人题目表 (User Questions)
CREATE TABLE IF NOT EXISTS user_questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL REFERENCES user_question_banks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('single_choice', 'multiple_choice', 'true_false', 'fill_blank')),
    question TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty INTEGER DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以优化查询性能
CREATE INDEX IF NOT EXISTS idx_lessons_unit_id ON lessons(unit_id);
CREATE INDEX IF NOT EXISTS idx_challenges_lesson_id ON challenges(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON user_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_lesson_id ON user_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_user_id ON knowledge_items(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_lesson_id ON knowledge_items(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_question_banks_user_id ON user_question_banks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_questions_bank_id ON user_questions(bank_id);

-- 启用行级安全
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_questions ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
-- 1. Units: 所有人可读，仅管理员可写
CREATE POLICY "Units are viewable by everyone" ON units FOR SELECT USING (true);
CREATE POLICY "Only admins can insert units" ON units FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can update units" ON units FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can delete units" ON units FOR DELETE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));

-- 2. Lessons: 所有人可读，仅管理员可写
CREATE POLICY "Lessons are viewable by everyone" ON lessons FOR SELECT USING (true);
CREATE POLICY "Only admins can insert lessons" ON lessons FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can update lessons" ON lessons FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can delete lessons" ON lessons FOR DELETE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));

-- 3. Challenges: 所有人可读，仅管理员可写
CREATE POLICY "Challenges are viewable by everyone" ON challenges FOR SELECT USING (true);
CREATE POLICY "Only admins can insert challenges" ON challenges FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can update challenges" ON challenges FOR UPDATE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));
CREATE POLICY "Only admins can delete challenges" ON challenges FOR DELETE USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));

-- 4. User Progress: 用户只能管理自己的进度
CREATE POLICY "Users can view their own progress" ON user_progress FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own progress" ON user_progress FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own progress" ON user_progress FOR DELETE USING (auth.uid()::text = user_id);

-- 5. Knowledge Items: 用户只能管理自己的知识点
CREATE POLICY "Users can view their own knowledge items" ON knowledge_items FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own knowledge items" ON knowledge_items FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own knowledge items" ON knowledge_items FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own knowledge items" ON knowledge_items FOR DELETE USING (auth.uid()::text = user_id);

-- 6. Admins: 仅超级管理员可以管理
CREATE POLICY "Super admin can manage admins" ON admins FOR ALL USING (auth.email() = 'admin@labzoon.com');
CREATE POLICY "Admins are viewable by admins" ON admins FOR SELECT USING (EXISTS (
    SELECT 1 FROM admins WHERE admins.email = auth.email()
));

-- 7. User Question Banks: 用户只能管理自己的题库
CREATE POLICY "Users can view their own question banks" ON user_question_banks FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert their own question banks" ON user_question_banks FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update their own question banks" ON user_question_banks FOR UPDATE USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete their own question banks" ON user_question_banks FOR DELETE USING (auth.uid()::text = user_id);

-- 8. User Questions: 用户只能管理自己的题库中的题目
CREATE POLICY "Users can view questions in their own banks" ON user_questions FOR SELECT USING (EXISTS (
    SELECT 1 FROM user_question_banks WHERE user_question_banks.id = user_questions.bank_id AND user_question_banks.user_id = auth.uid()::text
));
CREATE POLICY "Users can insert questions in their own banks" ON user_questions FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM user_question_banks WHERE user_question_banks.id = user_questions.bank_id AND user_question_banks.user_id = auth.uid()::text
));
CREATE POLICY "Users can update questions in their own banks" ON user_questions FOR UPDATE USING (EXISTS (
    SELECT 1 FROM user_question_banks WHERE user_question_banks.id = user_questions.bank_id AND user_question_banks.user_id = auth.uid()::text
));
CREATE POLICY "Users can delete questions in their own banks" ON user_questions FOR DELETE USING (EXISTS (
    SELECT 1 FROM user_question_banks WHERE user_question_banks.id = user_questions.bank_id AND user_question_banks.user_id = auth.uid()::text
));

-- 插入默认管理员（请将 email 替换为实际的超级管理员邮箱）
INSERT INTO admins (email) 
VALUES ('admin@labzoon.com') 
ON CONFLICT (email) DO NOTHING;

-- 创建更新时间戳的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 为需要的表添加更新时间戳触发器
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_lessons_updated_at BEFORE UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_challenges_updated_at BEFORE UPDATE ON challenges FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON knowledge_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_question_banks_updated_at BEFORE UPDATE ON user_question_banks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_questions_updated_at BEFORE UPDATE ON user_questions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();