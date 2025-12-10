-- 将管理员知识库中的内容迁移到某个用户的个人知识库
-- 使用方法：在 Supabase SQL 编辑器中执行：
-- SELECT migrate_kb_to_user('00000000-0000-0000-0000-000000000000'::uuid);

CREATE OR REPLACE FUNCTION migrate_kb_to_user(target_user UUID)
RETURNS INTEGER AS $$
DECLARE
  migrated_count INTEGER := 0;
BEGIN
  INSERT INTO user_knowledge_base (id, user_id, title, content, type, image_data, tags, created_at, updated_at)
  SELECT 
    CONCAT('kb-user-', kb.id) AS id,
    target_user AS user_id,
    kb.title,
    kb.content,
    kb.type,
    kb.image_data,
    '[]'::jsonb AS tags,
    kb.created_at,
    kb.created_at
  FROM knowledge_base kb
  ON CONFLICT (id) DO NOTHING;

  GET DIAGNOSTICS migrated_count = ROW_COUNT;
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION migrate_kb_to_user(UUID) IS '将全局知识库内容复制到指定用户的个人知识库（不删除原记录）';
