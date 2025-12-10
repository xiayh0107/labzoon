/**
 * Curriculum API v2 - 支持新的数据库结构
 * 单元、课程、题目分开存储
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize Supabase
const getSupabase = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, supabaseServiceKey);
};

// --- Types ---
interface Unit {
  id: string;
  title: string;
  description?: string;
  color: string;
  order_index: number;
}

interface Lesson {
  id: string;
  unit_id: string;
  title: string;
  order_index: number;
}

interface Challenge {
  id: string;
  lesson_id: string;
  type: string;
  question: string;
  correct_answer: string;
  options?: any[];
  explanation?: string;
  image_url?: string;
  order_index: number;
}

// --- Middleware: Verify Admin ---
const verifyAdmin = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    const supabase = getSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw new Error('Invalid token');

    // Check admin status
    if (user.email !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', user.email)
        .single();
      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// Units API
// ============================================

// GET /api/v2/units - 获取所有单元（带课程数量）
router.get('/units', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    const { data: units, error } = await supabase
      .from('units')
      .select(`
        *,
        lessons:lessons(count)
      `)
      .order('order_index');

    if (error) throw error;
    res.json({ data: units || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/units/outline - 获取课程大纲（单元+课程列表，不含题目）
router.get('/units/outline', async (req, res) => {
  try {
    const supabase = getSupabase();
    
    // 获取所有单元
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .order('order_index');
    if (unitsError) throw unitsError;

    // 获取所有课程
    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, unit_id, title, order_index')
      .order('order_index');
    if (lessonsError) throw lessonsError;

    // 获取每个课程的题目数量
    const { data: challengeCounts, error: countError } = await supabase
      .from('challenges')
      .select('lesson_id');
    if (countError) throw countError;

    // 统计每个课程的题目数
    const countMap = new Map<string, number>();
    (challengeCounts || []).forEach((c: any) => {
      countMap.set(c.lesson_id, (countMap.get(c.lesson_id) || 0) + 1);
    });

    // 组装数据
    const outline = (units || []).map((unit: any) => ({
      ...unit,
      lessons: (lessons || [])
        .filter((l: any) => l.unit_id === unit.id)
        .map((l: any) => ({
          ...l,
          challengeCount: countMap.get(l.id) || 0
        }))
    }));

    res.json({ data: outline });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/units - 创建单元
router.post('/units', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id, title, description, color } = req.body;

    // 获取最大 order_index
    const { data: maxOrder } = await supabase
      .from('units')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const newOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    // 创建快照
    await createSnapshot(supabase, 'before_update', '创建单元前', (req as any).user?.email);

    const { data, error } = await supabase
      .from('units')
      .insert({
        id: id || `unit-${Date.now()}`,
        title,
        description,
        color: color || 'blue',
        order_index: newOrderIndex
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v2/units/:id - 更新单元
router.put('/units/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { title, description, color, order_index } = req.body;

    const { data, error } = await supabase
      .from('units')
      .update({ title, description, color, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v2/units/:id - 删除单元（级联删除课程和题目）
router.delete('/units/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // 创建快照
    await createSnapshot(supabase, 'before_delete', `删除单元 ${id} 前`, (req as any).user?.email);

    const { error } = await supabase
      .from('units')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Lessons API
// ============================================

// GET /api/v2/lessons/:id - 获取课程详情（含题目）
router.get('/lessons/:id', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    // 获取课程
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single();
    if (lessonError) throw lessonError;

    // 获取题目
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .eq('lesson_id', id)
      .order('order_index');
    if (challengesError) throw challengesError;

    res.json({ 
      data: {
        ...lesson,
        challenges: challenges || []
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/lessons - 创建课程
router.post('/lessons', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id, unit_id, title } = req.body;

    // 获取最大 order_index
    const { data: maxOrder } = await supabase
      .from('lessons')
      .select('order_index')
      .eq('unit_id', unit_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const newOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        id: id || `lesson-${Date.now()}`,
        unit_id,
        title,
        order_index: newOrderIndex
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v2/lessons/:id - 更新课程
router.put('/lessons/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { title, order_index } = req.body;

    const { data, error } = await supabase
      .from('lessons')
      .update({ title, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v2/lessons/:id - 删除课程
router.delete('/lessons/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    await createSnapshot(supabase, 'before_delete', `删除课程 ${id} 前`, (req as any).user?.email);

    const { error } = await supabase
      .from('lessons')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Challenges API
// ============================================

// GET /api/v2/challenges - 获取题目列表
router.get('/challenges', async (req, res) => {
  try {
    const supabase = getSupabase();
    const { lesson_id, limit = 100 } = req.query;

    let query = supabase
      .from('challenges')
      .select('*')
      .order('order_index')
      .limit(Number(limit));

    if (lesson_id) {
      query = query.eq('lesson_id', lesson_id);
    }

    const { data, error } = await query;
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/challenges - 创建题目
router.post('/challenges', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id, lesson_id, type, question, correct_answer, options, explanation, image_url } = req.body;

    // 获取最大 order_index
    const { data: maxOrder } = await supabase
      .from('challenges')
      .select('order_index')
      .eq('lesson_id', lesson_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    const newOrderIndex = (maxOrder?.order_index ?? -1) + 1;

    const { data, error } = await supabase
      .from('challenges')
      .insert({
        id: id || `challenge-${Date.now()}`,
        lesson_id,
        type,
        question,
        correct_answer,
        options,
        explanation,
        image_url,
        order_index: newOrderIndex
      })
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/challenges/batch - 批量创建题目
router.post('/challenges/batch', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { lesson_id, challenges } = req.body;

    console.log('Creating batch challenges:', { lesson_id, count: challenges?.length });

    if (!lesson_id) {
      return res.status(400).json({ error: 'lesson_id is required' });
    }

    if (!Array.isArray(challenges) || challenges.length === 0) {
      return res.status(400).json({ error: 'challenges must be a non-empty array' });
    }

    // 获取当前最大 order_index
    const { data: maxOrder } = await supabase
      .from('challenges')
      .select('order_index')
      .eq('lesson_id', lesson_id)
      .order('order_index', { ascending: false })
      .limit(1)
      .single();

    let orderIndex = (maxOrder?.order_index ?? -1) + 1;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);

    // 准备批量插入数据，确保每个 challenge 都有唯一 ID
    const insertData = challenges.map((c: any, idx: number) => ({
      id: `ch-${timestamp}-${randomSuffix}-${idx}`,
      lesson_id,
      type: c.type || 'SINGLE_CHOICE',
      question: c.question || '',
      correct_answer: c.correctAnswer || c.correct_answer || '',
      options: c.options || [],
      explanation: c.explanation || null,
      image_url: c.imageUrl || c.image_url || null,
      order_index: orderIndex++
    }));

    console.log('Inserting challenges:', insertData.length);

    const { data, error } = await supabase
      .from('challenges')
      .insert(insertData)
      .select();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }
    
    console.log('Challenges created successfully:', data?.length);
    res.json({ success: true, data, count: data?.length || 0 });
  } catch (error: any) {
    console.error('Failed to create challenges batch:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/v2/challenges/:id - 更新题目
router.put('/challenges/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const { type, question, correct_answer, options, explanation, image_url, order_index } = req.body;

    const { data, error } = await supabase
      .from('challenges')
      .update({ type, question, correct_answer, options, explanation, image_url, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/v2/challenges/:id - 删除题目
router.delete('/challenges/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { error } = await supabase
      .from('challenges')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Snapshots API (数据备份/恢复)
// ============================================

// GET /api/v2/snapshots - 获取快照列表
router.get('/snapshots', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { limit = 20 } = req.query;

    const { data, error } = await supabase
      .from('data_snapshots')
      .select('id, snapshot_type, description, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/v2/snapshots/:id - 获取快照详情
router.get('/snapshots/:id', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;

    const { data, error } = await supabase
      .from('data_snapshots')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/snapshots - 手动创建快照
router.post('/snapshots', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { description } = req.body;
    const userEmail = (req as any).user?.email;

    const snapshotId = await createSnapshot(supabase, 'manual', description || '手动备份', userEmail);
    res.json({ success: true, snapshotId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/v2/snapshots/:id/restore - 从快照恢复
router.post('/snapshots/:id/restore', verifyAdmin, async (req, res) => {
  try {
    const supabase = getSupabase();
    const { id } = req.params;
    const userEmail = (req as any).user?.email;

    // 获取快照数据
    const { data: snapshot, error: fetchError } = await supabase
      .from('data_snapshots')
      .select('data')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!snapshot?.data) throw new Error('Snapshot not found');

    // 先创建当前状态的备份
    await createSnapshot(supabase, 'before_restore', `恢复到快照 #${id} 前的备份`, userEmail);

    const snapshotData = snapshot.data as any;

    // 清空现有数据并恢复
    // 1. 删除所有题目
    await supabase.from('challenges').delete().neq('id', '');
    // 2. 删除所有课程
    await supabase.from('lessons').delete().neq('id', '');
    // 3. 删除所有单元
    await supabase.from('units').delete().neq('id', '');

    // 4. 恢复单元
    if (snapshotData.units && snapshotData.units.length > 0) {
      const { error: unitsError } = await supabase
        .from('units')
        .insert(snapshotData.units.map((u: any) => ({
          id: u.id,
          title: u.title,
          description: u.description,
          color: u.color,
          order_index: u.order_index
        })));
      if (unitsError) throw unitsError;
    }

    // 5. 恢复课程
    if (snapshotData.lessons && snapshotData.lessons.length > 0) {
      const { error: lessonsError } = await supabase
        .from('lessons')
        .insert(snapshotData.lessons.map((l: any) => ({
          id: l.id,
          unit_id: l.unit_id,
          title: l.title,
          order_index: l.order_index
        })));
      if (lessonsError) throw lessonsError;
    }

    // 6. 恢复题目
    if (snapshotData.challenges && snapshotData.challenges.length > 0) {
      const { error: challengesError } = await supabase
        .from('challenges')
        .insert(snapshotData.challenges.map((c: any) => ({
          id: c.id,
          lesson_id: c.lesson_id,
          type: c.type,
          question: c.question,
          correct_answer: c.correct_answer,
          options: c.options,
          explanation: c.explanation,
          image_url: c.image_url,
          order_index: c.order_index
        })));
      if (challengesError) throw challengesError;
    }

    res.json({ 
      success: true, 
      restored: {
        units: snapshotData.units?.length || 0,
        lessons: snapshotData.lessons?.length || 0,
        challenges: snapshotData.challenges?.length || 0
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// Helper Functions
// ============================================

async function createSnapshot(
  supabase: any, 
  type: string, 
  description: string, 
  createdBy?: string
): Promise<number> {
  // 收集当前数据
  const { data: units } = await supabase.from('units').select('*').order('order_index');
  const { data: lessons } = await supabase.from('lessons').select('*').order('order_index');
  const { data: challenges } = await supabase.from('challenges').select('*').order('order_index');

  const snapshotData = {
    units: units || [],
    lessons: lessons || [],
    challenges: challenges || [],
    snapshot_time: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('data_snapshots')
    .insert({
      snapshot_type: type,
      description,
      data: snapshotData,
      created_by: createdBy || 'system'
    })
    .select('id')
    .single();

  if (error) throw error;

  // 清理旧快照（保留最近 50 个）
  const { data: oldSnapshots } = await supabase
    .from('data_snapshots')
    .select('id')
    .order('created_at', { ascending: false })
    .range(50, 1000);

  if (oldSnapshots && oldSnapshots.length > 0) {
    const idsToDelete = oldSnapshots.map((s: any) => s.id);
    await supabase.from('data_snapshots').delete().in('id', idsToDelete);
  }

  return data.id;
}

export default router;
