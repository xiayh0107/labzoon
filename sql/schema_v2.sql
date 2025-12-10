-- ============================================
-- LabZoon Database Schema v2
-- 重构后的数据库结构：将单元、课程、题目拆分为独立表
-- ============================================

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

-- 3. 题目表 (Challenges) - 独立存储每道题目
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
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

-- 4. 版本历史表 (用于数据恢复)
CREATE TABLE IF NOT EXISTS data_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_type TEXT NOT NULL, -- 'auto', 'manual', 'before_update'
    description TEXT,
    data JSONB NOT NULL, -- 完整的数据快照
    created_by TEXT, -- 操作用户的邮箱
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 用户课程进度表 (重构)
CREATE TABLE IF NOT EXISTS user_lesson_progress (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    completed BOOLEAN DEFAULT FALSE,
    stars INTEGER DEFAULT 0,
    completed_at TIMESTAMPTZ,
    UNIQUE(user_id, lesson_id)
);

-- 6. 用户汇总数据表 (存储 xp, hearts, streak 等)
CREATE TABLE IF NOT EXISTS user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- 索引
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_unit_id ON lessons(unit_id);
CREATE INDEX IF NOT EXISTS idx_challenges_lesson_id ON challenges(lesson_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress ((data->>'xp'));
CREATE INDEX IF NOT EXISTS idx_data_snapshots_created ON data_snapshots(created_at DESC);

-- ============================================
-- 自动更新 updated_at 触发器
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_challenges_updated_at ON challenges;
CREATE TRIGGER update_challenges_updated_at
    BEFORE UPDATE ON challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- RLS 策略 (Row Level Security)
-- ============================================

-- Units: 所有人可读，管理员可写
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read units" ON units;
CREATE POLICY "Public read units" ON units FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access units" ON units;
CREATE POLICY "Service role full access units" ON units FOR ALL USING (true);

-- Lessons: 所有人可读，管理员可写
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read lessons" ON lessons;
CREATE POLICY "Public read lessons" ON lessons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access lessons" ON lessons;
CREATE POLICY "Service role full access lessons" ON lessons FOR ALL USING (true);

-- Challenges: 所有人可读，管理员可写
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read challenges" ON challenges;
CREATE POLICY "Public read challenges" ON challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access challenges" ON challenges;
CREATE POLICY "Service role full access challenges" ON challenges FOR ALL USING (true);

-- Data Snapshots: 仅服务端可访问
ALTER TABLE data_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access snapshots" ON data_snapshots;
CREATE POLICY "Service role full access snapshots" ON data_snapshots FOR ALL USING (true);

-- User Lesson Progress: 用户只能读写自己的进度
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can read own lesson progress" ON user_lesson_progress 
    FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can insert own lesson progress" ON user_lesson_progress 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own lesson progress" ON user_lesson_progress;
CREATE POLICY "Users can update own lesson progress" ON user_lesson_progress 
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access lesson progress" ON user_lesson_progress;
CREATE POLICY "Service role full access lesson progress" ON user_lesson_progress FOR ALL USING (true);

-- User Progress: 已登录用户可读取所有人的进度（排行榜），只能写自己的
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read all progress" ON user_progress;
CREATE POLICY "Authenticated users can read all progress" ON user_progress 
    FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress" ON user_progress 
    FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress" ON user_progress 
    FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role full access progress" ON user_progress;
CREATE POLICY "Service role full access progress" ON user_progress FOR ALL USING (true);

-- ============================================
-- 快照管理函数
-- ============================================

-- 创建数据快照的函数
CREATE OR REPLACE FUNCTION create_data_snapshot(
    p_snapshot_type TEXT,
    p_description TEXT,
    p_created_by TEXT
) RETURNS INTEGER AS $$
DECLARE
    snapshot_id INTEGER;
    snapshot_data JSONB;
BEGIN
    -- 收集所有数据
    SELECT jsonb_build_object(
        'units', (SELECT COALESCE(jsonb_agg(row_to_json(u.*) ORDER BY u.order_index), '[]'::jsonb) FROM units u),
        'lessons', (SELECT COALESCE(jsonb_agg(row_to_json(l.*) ORDER BY l.order_index), '[]'::jsonb) FROM lessons l),
        'challenges', (SELECT COALESCE(jsonb_agg(row_to_json(c.*) ORDER BY c.order_index), '[]'::jsonb) FROM challenges c),
        'snapshot_time', NOW()
    ) INTO snapshot_data;
    
    -- 插入快照
    INSERT INTO data_snapshots (snapshot_type, description, data, created_by)
    VALUES (p_snapshot_type, p_description, snapshot_data, p_created_by)
    RETURNING id INTO snapshot_id;
    
    -- 保留最近 50 个快照，删除旧的
    DELETE FROM data_snapshots 
    WHERE id NOT IN (
        SELECT id FROM data_snapshots ORDER BY created_at DESC LIMIT 50
    );
    
    RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 注释
-- ============================================
COMMENT ON TABLE units IS '课程单元';
COMMENT ON TABLE lessons IS '课程/章节';
COMMENT ON TABLE challenges IS '题目/挑战';
COMMENT ON TABLE data_snapshots IS '数据快照，用于版本历史和恢复';
COMMENT ON TABLE user_lesson_progress IS '用户课程进度（每课一条记录）';
COMMENT ON TABLE user_progress IS '用户汇总数据（xp, hearts, streak等）';
