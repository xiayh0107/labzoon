-- ============================================
-- 清理旧表和数据
-- 运行此脚本前请确保已备份重要数据！
-- ============================================

-- 删除旧的单一大表
DROP TABLE IF EXISTS app_units CASCADE;

-- 删除旧的用户进度表（如果存在）
DROP TABLE IF EXISTS user_progress CASCADE;

-- 删除旧的知识库表（如果不再需要）
-- DROP TABLE IF EXISTS knowledge_base CASCADE;

-- 确保新表结构存在
-- (schema_v2.sql 应该已经创建了这些表)

-- 显示当前表
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
