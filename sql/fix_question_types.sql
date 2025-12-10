-- 修复题目类型和多选题答案格式
-- 运行此脚本前请先备份数据

-- 1. 统一类型字段为大写
UPDATE challenges SET type = UPPER(type);

-- 2. 将只有单个答案的 MULTIPLE_CHOICE 改为 SINGLE_CHOICE
UPDATE challenges 
SET type = 'SINGLE_CHOICE'
WHERE type = 'MULTIPLE_CHOICE' 
  AND correct_answer !~ '[,]'  -- 不包含逗号
  AND correct_answer !~ '^[A-Da-d]{2,}$';  -- 不是连续字母如 ABCD

-- 3. 将连续字母格式的答案（如 "ABCD"）转换为逗号分隔格式（如 "A,B,C,D"）
-- 这个需要分步处理不同长度的答案

-- 处理 2 个答案的情况 (AB -> A,B)
UPDATE challenges 
SET correct_answer = 
    UPPER(SUBSTRING(correct_answer, 1, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 2, 1))
WHERE type = 'MULTIPLE_CHOICE' 
  AND correct_answer ~ '^[A-Da-d]{2}$';

-- 处理 3 个答案的情况 (ABC -> A,B,C)
UPDATE challenges 
SET correct_answer = 
    UPPER(SUBSTRING(correct_answer, 1, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 2, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 3, 1))
WHERE type = 'MULTIPLE_CHOICE' 
  AND correct_answer ~ '^[A-Da-d]{3}$';

-- 处理 4 个答案的情况 (ABCD -> A,B,C,D)
UPDATE challenges 
SET correct_answer = 
    UPPER(SUBSTRING(correct_answer, 1, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 2, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 3, 1)) || ',' ||
    UPPER(SUBSTRING(correct_answer, 4, 1))
WHERE type = 'MULTIPLE_CHOICE' 
  AND correct_answer ~ '^[A-Da-d]{4}$';

-- 4. 将答案中的小写字母统一为大写（针对已有逗号分隔的格式）
UPDATE challenges 
SET correct_answer = UPPER(correct_answer)
WHERE correct_answer ~ '[a-d]';

-- 5. 查看修复后的统计
SELECT type, COUNT(*) as count 
FROM challenges 
GROUP BY type 
ORDER BY type;

-- 6. 查看多选题及其答案
SELECT id, type, question, correct_answer 
FROM challenges 
WHERE type = 'MULTIPLE_CHOICE'
LIMIT 20;
