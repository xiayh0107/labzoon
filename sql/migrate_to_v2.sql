-- ============================================
-- 数据迁移脚本：从旧结构迁移到新结构
-- 运行此脚本前，请先运行 schema_v2.sql
-- ============================================

-- 步骤 1: 在迁移前创建备份快照
DO $$
DECLARE
    old_data JSONB;
BEGIN
    -- 获取旧数据
    SELECT data INTO old_data FROM app_units WHERE id = 'global-units';
    
    IF old_data IS NOT NULL THEN
        -- 保存到快照表
        INSERT INTO data_snapshots (snapshot_type, description, data, created_by)
        VALUES (
            'migration_backup',
            '迁移到 v2 结构前的备份',
            jsonb_build_object('app_units', old_data, 'backup_time', NOW()),
            'system'
        );
        RAISE NOTICE '备份完成';
    ELSE
        RAISE NOTICE '没有找到旧数据';
    END IF;
END $$;

-- 步骤 2: 迁移单元数据
INSERT INTO units (id, title, description, color, order_index, created_at)
SELECT 
    unit->>'id',
    unit->>'title',
    unit->>'description',
    COALESCE(unit->>'color', 'blue'),
    (row_number() OVER ())::INTEGER - 1,
    NOW()
FROM app_units, jsonb_array_elements(data) AS unit
WHERE id = 'global-units'
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();

-- 步骤 3: 迁移课程数据
INSERT INTO lessons (id, unit_id, title, order_index, created_at)
SELECT 
    lesson->>'id',
    unit->>'id',
    lesson->>'title',
    (row_number() OVER (PARTITION BY unit->>'id'))::INTEGER - 1,
    NOW()
FROM app_units, 
     jsonb_array_elements(data) AS unit,
     jsonb_array_elements(unit->'lessons') AS lesson
WHERE app_units.id = 'global-units'
ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();

-- 步骤 4: 迁移题目数据
INSERT INTO challenges (id, lesson_id, type, question, correct_answer, options, explanation, image_url, order_index, created_at)
SELECT 
    challenge->>'id',
    lesson->>'id',
    COALESCE(challenge->>'type', 'SINGLE_CHOICE'),
    COALESCE(challenge->>'question', ''),
    COALESCE(challenge->>'correctAnswer', ''),
    (challenge->'options')::JSONB,
    challenge->>'explanation',
    challenge->>'imageUrl',
    (row_number() OVER (PARTITION BY lesson->>'id'))::INTEGER - 1,
    NOW()
FROM app_units,
     jsonb_array_elements(data) AS unit,
     jsonb_array_elements(unit->'lessons') AS lesson,
     jsonb_array_elements(lesson->'challenges') AS challenge
WHERE app_units.id = 'global-units'
  AND challenge->>'id' IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    type = EXCLUDED.type,
    question = EXCLUDED.question,
    correct_answer = EXCLUDED.correct_answer,
    options = EXCLUDED.options,
    explanation = EXCLUDED.explanation,
    image_url = EXCLUDED.image_url,
    order_index = EXCLUDED.order_index,
    updated_at = NOW();

-- 步骤 5: 迁移用户进度数据
-- 注意：需要根据 completedLessonIds 创建进度记录
INSERT INTO user_lesson_progress (user_id, lesson_id, completed, stars, completed_at)
SELECT 
    up.user_id,
    lesson_id,
    TRUE,
    0,
    NOW()
FROM user_progress up,
     jsonb_array_elements_text(up.data->'completedLessonIds') AS lesson_id
WHERE EXISTS (SELECT 1 FROM lessons WHERE id = lesson_id)
ON CONFLICT (user_id, lesson_id) DO UPDATE SET
    completed = TRUE,
    completed_at = COALESCE(user_lesson_progress.completed_at, NOW());

-- 步骤 6: 验证迁移结果
DO $$
DECLARE
    unit_count INTEGER;
    lesson_count INTEGER;
    challenge_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO unit_count FROM units;
    SELECT COUNT(*) INTO lesson_count FROM lessons;
    SELECT COUNT(*) INTO challenge_count FROM challenges;
    
    RAISE NOTICE '迁移完成统计:';
    RAISE NOTICE '  - 单元数: %', unit_count;
    RAISE NOTICE '  - 课程数: %', lesson_count;
    RAISE NOTICE '  - 题目数: %', challenge_count;
END $$;

-- 步骤 7: 创建迁移后的快照
SELECT create_data_snapshot('migration_complete', '迁移到 v2 结构完成', 'system');
