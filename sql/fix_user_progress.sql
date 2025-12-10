-- ============================================
-- 修复脚本：创建 user_progress 表
-- 在 Supabase SQL Editor 中运行此脚本
-- ============================================

-- 创建用户汇总数据表
CREATE TABLE IF NOT EXISTS user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    data JSONB DEFAULT '{}'::jsonb
);

-- 创建索引用于排行榜排序
CREATE INDEX IF NOT EXISTS idx_user_progress_xp ON user_progress ((data->>'xp'));

-- 启用 RLS
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;

-- 已登录用户可读取所有人的进度（用于排行榜）
DROP POLICY IF EXISTS "Authenticated users can read all progress" ON user_progress;
CREATE POLICY "Authenticated users can read all progress" ON user_progress 
    FOR SELECT USING (auth.role() = 'authenticated');

-- 用户只能插入自己的记录
DROP POLICY IF EXISTS "Users can insert own progress" ON user_progress;
CREATE POLICY "Users can insert own progress" ON user_progress 
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的记录
DROP POLICY IF EXISTS "Users can update own progress" ON user_progress;
CREATE POLICY "Users can update own progress" ON user_progress 
    FOR UPDATE USING (auth.uid() = user_id);

-- 服务端完全访问
DROP POLICY IF EXISTS "Service role full access progress" ON user_progress;
CREATE POLICY "Service role full access progress" ON user_progress FOR ALL USING (true);

-- 添加注释
COMMENT ON TABLE user_progress IS '用户汇总数据（xp, hearts, streak等，用于排行榜）';

-- 验证表创建成功
SELECT 'user_progress 表创建成功!' as status;
