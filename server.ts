import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import aiRouter from './server/ai.js';
import tasksRouter from './server/tasks.js';
import curriculumRouter from './server/curriculum.js';

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for base64 images

// AI Routes (mount before static files)
app.use('/api/ai', aiRouter);

// Task Management Routes
app.use('/api/tasks', tasksRouter);

// Curriculum v2 Routes (新的数据结构)
app.use('/api/v2', curriculumRouter);

// Serve static files from the React app
// In production, both server.js and frontend assets are in /app/dist
// __dirname points to where server.js is located
const distPath = __dirname; // server.js and frontend assets are in the same dist/ folder
app.use(express.static(distPath));

// Initialize Supabase with SERVICE ROLE (server-side only)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing Supabase credentials in environment variables!');
  console.error('Please ensure .env file exists with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// --- Middleware: Verify JWT Token from Frontend ---
const verifyToken = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Missing authentication token' });
  }

  try {
    // Verify using Supabase Auth API (No JWT Secret needed)
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new Error('Invalid token');
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// --- API ROUTES ---

// ============================================
// DEPRECATED: V1 API Routes (using app_units table)
// These endpoints are kept for backward compatibility but should not be used.
// Use /api/v2/* endpoints instead which use the normalized schema (units, lessons, challenges tables).
// ============================================

// 1. GET /api/units - Fetch global curriculum (FULL - for admin)
// DEPRECATED: Use GET /api/v2/units instead
app.get('/api/units', async (req, res) => {
  try {
    // Forward to v2 API
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .order('order_index');
    
    if (unitsError) throw unitsError;

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('*')
      .order('order_index');
    
    if (lessonsError) throw lessonsError;

    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .order('order_index');
    
    if (challengesError) throw challengesError;

    // Convert to v1 format
    const result = (units || []).map((unit: any) => ({
      ...unit,
      lessons: (lessons || [])
        .filter((l: any) => l.unit_id === unit.id)
        .map((lesson: any) => ({
          ...lesson,
          challenges: (challenges || [])
            .filter((c: any) => c.lesson_id === lesson.id)
            .map((c: any) => ({
              id: c.id,
              type: c.type,
              question: c.question,
              correctAnswer: c.correct_answer,
              options: c.options,
              explanation: c.explanation,
              imageUrl: c.image_url
            }))
        }))
    }));

    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1.1 GET /api/units/outline - Fetch lightweight curriculum outline (for fast loading)
// DEPRECATED: Use GET /api/v2/units/outline instead
app.get('/api/units/outline', async (req, res) => {
  try {
    // Forward to v2 API - get from normalized tables
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*')
      .order('order_index');
    
    if (unitsError) throw unitsError;

    const { data: lessons, error: lessonsError } = await supabase
      .from('lessons')
      .select('id, unit_id, title, order_index')
      .order('order_index');
    
    if (lessonsError) throw lessonsError;

    // Count challenges per lesson
    const { data: challengeCounts, error: countError } = await supabase
      .from('challenges')
      .select('lesson_id');
    
    if (countError) throw countError;

    const lessonChallengeCounts = new Map<string, number>();
    (challengeCounts || []).forEach((c: any) => {
      lessonChallengeCounts.set(c.lesson_id, (lessonChallengeCounts.get(c.lesson_id) || 0) + 1);
    });

    // Build outline
    const outline = (units || []).map((unit: any) => ({
      id: unit.id,
      title: unit.title,
      description: unit.description,
      color: unit.color,
      lessons: (lessons || [])
        .filter((l: any) => l.unit_id === unit.id)
        .map((lesson: any) => ({
          id: lesson.id,
          title: lesson.title,
          completed: false,
          locked: false,
          stars: 0,
          challengeCount: lessonChallengeCounts.get(lesson.id) || 0
        }))
    }));

    res.json({ data: outline });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1.2 GET /api/units/:unitId/lessons/:lessonId - Fetch specific lesson with challenges
// DEPRECATED: Use GET /api/v2/lessons/:id instead
app.get('/api/units/:unitId/lessons/:lessonId', async (req, res) => {
  try {
    const { lessonId } = req.params;

    // Get lesson from v2 table
    const { data: lesson, error: lessonError } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .single();

    if (lessonError) {
      if (lessonError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Lesson not found' });
      }
      throw lessonError;
    }

    // Get challenges
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('*')
      .eq('lesson_id', lessonId)
      .order('order_index');

    if (challengesError) throw challengesError;

    // Convert to v1 format
    const result = {
      ...lesson,
      challenges: (challenges || []).map((c: any) => ({
        id: c.id,
        type: c.type,
        question: c.question,
        correctAnswer: c.correct_answer,
        options: c.options,
        explanation: c.explanation,
        imageUrl: c.image_url
      }))
    };

    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. POST /api/units - Update global curriculum (Admins only)
// DEPRECATED: This endpoint is no longer used. 
// Use individual v2 API endpoints to update units, lessons, and challenges.
app.post('/api/units', verifyToken, async (req, res) => {
  // Return deprecation notice
  res.status(410).json({ 
    error: 'This endpoint is deprecated. Please use /api/v2/* endpoints instead.',
    message: 'Use PUT /api/v2/units/:id, PUT /api/v2/lessons/:id, PUT /api/v2/challenges/:id'
  });
});

// 3. GET /api/user/progress - Fetch user progress
app.get('/api/user/progress', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const { data, error } = await supabase
      .from('user_progress')
      .select('data')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    res.json({ data: data?.data || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. POST /api/user/progress - Update user progress
app.post('/api/user/progress', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;
    const { progress } = req.body;

    // Always ensure email is included
    const progressToSave = {
      ...progress,
      email: userEmail,
      lastActive: Date.now()
    };

    const { error } = await supabase
      .from('user_progress')
      .upsert({ user_id: userId, data: progressToSave });

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. GET /api/knowledge-base - Admin only
app.get('/api/knowledge-base', verifyToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    if (userEmail !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();
      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. POST /api/knowledge-base - Add knowledge base item (Admins only)
app.post('/api/knowledge-base', verifyToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    const { id, title, content, type, imageData } = req.body;

    // Check admin status
    if (userEmail !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();

      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const { error } = await supabase
      .from('knowledge_base')
      .insert({
        id,
        title,
        content,
        type,
        image_data: imageData,
        created_at: Date.now()
      });

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. DELETE /api/knowledge-base/:id - Delete knowledge base item (Admins only)
app.delete('/api/knowledge-base/:id', verifyToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    const { id } = req.params;

    // Check admin status
    if (userEmail !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();

      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. GET /api/admins - Get all admins
app.get('/api/admins', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('app_admins')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. POST /api/admins - Add admin (Admins only)
app.post('/api/admins', verifyToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    const { email } = req.body;

    // Check admin status
    if (userEmail !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();

      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const { error } = await supabase
      .from('app_admins')
      .insert({ email, created_at: Date.now() });

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. DELETE /api/admins/:email - Remove admin (Admins only)
app.delete('/api/admins/:email', verifyToken, async (req, res) => {
  try {
    const userEmail = (req as any).user.email;
    const { email } = req.params;

    // Check admin status
    if (userEmail !== 'admin@labzoon.com') {
      const { data: adminData } = await supabase
        .from('app_admins')
        .select('email')
        .eq('email', userEmail)
        .single();

      if (!adminData) {
        return res.status(403).json({ error: 'Admin access required' });
      }
    }

    const { error } = await supabase
      .from('app_admins')
      .delete()
      .eq('email', email);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. GET /api/leaderboard - Fetch leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('user_progress')
      .select('user_id, data')
      .order('data->xp', { ascending: false })
      .limit(100);

    if (error) throw error;

    const leaderboard = (data || []).map((item: any) => ({
      userId: item.user_id,
      email: item.data?.email,
      username: item.data?.username,
      xp: item.data?.xp || 0,
      hearts: item.data?.hearts || 0,
      streak: item.data?.streak || 0
    }));

    res.json({ data: leaderboard });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. POST /api/init-user - Initialize new user (called after auth signup)
app.post('/api/init-user', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const userEmail = (req as any).user.email;

    const { error } = await supabase
      .from('user_progress')
      .insert({
        user_id: userId,
        data: {
          hearts: 5,
          xp: 0,
          streak: 1,
          completedLessonIds: [],
          email: userEmail
        }
      });

    // Ignore if already exists
    if (error && error.code !== '23505') {
      throw error;
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// 用户私人题库 API (User Question Banks)
// ============================================

// 13. GET /api/user/banks - 获取当前用户的所有题库
app.get('/api/user/banks', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    const { data: banks, error: banksError } = await supabase
      .from('user_question_banks')
      .select('*')
      .eq('user_id', userId)
      .order('order_index');

    if (banksError) throw banksError;

    // 获取每个题库的章节和题目统计
    const bankIds = (banks || []).map((b: any) => b.id);
    
    let sections: any[] = [];
    if (bankIds.length > 0) {
      const { data: sectionsData, error: sectionsError } = await supabase
        .from('user_bank_sections')
        .select('id, bank_id, title, order_index')
        .in('bank_id', bankIds)
        .order('order_index');
      
      if (sectionsError) throw sectionsError;
      sections = sectionsData || [];
    }

    // 统计每个章节的题目数量
    const sectionIds = sections.map(s => s.id);
    let challengeCounts: Record<string, number> = {};
    
    if (sectionIds.length > 0) {
      const { data: countData, error: countError } = await supabase
        .from('user_bank_challenges')
        .select('section_id')
        .in('section_id', sectionIds);
      
      if (!countError && countData) {
        countData.forEach((c: any) => {
          challengeCounts[c.section_id] = (challengeCounts[c.section_id] || 0) + 1;
        });
      }
    }

    // 组装返回数据
    const result = (banks || []).map((bank: any) => ({
      ...bank,
      sections: sections
        .filter(s => s.bank_id === bank.id)
        .map(s => ({
          ...s,
          challengeCount: challengeCounts[s.id] || 0
        })),
      totalChallenges: sections
        .filter(s => s.bank_id === bank.id)
        .reduce((sum, s) => sum + (challengeCounts[s.id] || 0), 0)
    }));

    res.json({ data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 14. POST /api/user/banks - 创建新题库
app.post('/api/user/banks', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id, title, description, color, icon } = req.body;

    // 获取当前最大order_index
    const { data: existing } = await supabase
      .from('user_question_banks')
      .select('order_index')
      .eq('user_id', userId)
      .order('order_index', { ascending: false })
      .limit(1);
    
    const nextOrder = (existing?.[0]?.order_index || 0) + 1;

    const { data, error } = await supabase
      .from('user_question_banks')
      .insert({
        id: id || `bank-${Date.now()}`,
        user_id: userId,
        title,
        description,
        color: color || 'blue',
        icon: icon || '📚',
        order_index: nextOrder
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 15. PUT /api/user/banks/:id - 更新题库
app.put('/api/user/banks/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { title, description, color, icon, order_index } = req.body;

    const { data, error } = await supabase
      .from('user_question_banks')
      .update({ title, description, color, icon, order_index })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 16. DELETE /api/user/banks/:id - 删除题库
app.delete('/api/user/banks/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const { error } = await supabase
      .from('user_question_banks')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 17. POST /api/user/banks/:bankId/sections - 创建章节
app.post('/api/user/banks/:bankId/sections', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { bankId } = req.params;
    const { id, title } = req.body;

    // 验证题库属于当前用户
    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', bankId)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此题库' });
    }

    // 获取当前最大order_index
    const { data: existing } = await supabase
      .from('user_bank_sections')
      .select('order_index')
      .eq('bank_id', bankId)
      .order('order_index', { ascending: false })
      .limit(1);
    
    const nextOrder = (existing?.[0]?.order_index || 0) + 1;

    const { data, error } = await supabase
      .from('user_bank_sections')
      .insert({
        id: id || `section-${Date.now()}`,
        bank_id: bankId,
        title,
        order_index: nextOrder
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 18. PUT /api/user/sections/:id - 更新章节
app.put('/api/user/sections/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { title, order_index } = req.body;

    // 验证章节属于当前用户的题库
    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', id)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此章节' });
    }

    const { data, error } = await supabase
      .from('user_bank_sections')
      .update({ title, order_index })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 19. DELETE /api/user/sections/:id - 删除章节
app.delete('/api/user/sections/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // 验证章节属于当前用户的题库
    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', id)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此章节' });
    }

    const { error } = await supabase
      .from('user_bank_sections')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 20. GET /api/user/sections/:sectionId/challenges - 获取章节的题目
app.get('/api/user/sections/:sectionId/challenges', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { sectionId } = req.params;

    // 验证章节属于当前用户的题库
    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此章节' });
    }

    const { data, error } = await supabase
      .from('user_bank_challenges')
      .select('*')
      .eq('section_id', sectionId)
      .order('order_index');

    if (error) throw error;

    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 21. POST /api/user/sections/:sectionId/challenges - 添加题目
app.post('/api/user/sections/:sectionId/challenges', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { sectionId } = req.params;
    const { id, type, question, correct_answer, options, explanation, image_url } = req.body;

    // 验证章节属于当前用户的题库
    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此章节' });
    }

    // 获取当前最大order_index
    const { data: existing } = await supabase
      .from('user_bank_challenges')
      .select('order_index')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: false })
      .limit(1);
    
    const nextOrder = (existing?.[0]?.order_index || 0) + 1;

    const { data, error } = await supabase
      .from('user_bank_challenges')
      .insert({
        id: id || `challenge-${Date.now()}`,
        section_id: sectionId,
        type,
        question,
        correct_answer,
        options,
        explanation,
        image_url,
        order_index: nextOrder
      })
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 22. POST /api/user/sections/:sectionId/challenges/batch - 批量添加题目
app.post('/api/user/sections/:sectionId/challenges/batch', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { sectionId } = req.params;
    const { challenges } = req.body;

    // 验证章节属于当前用户的题库
    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', sectionId)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此章节' });
    }

    // 获取当前最大order_index
    const { data: existing } = await supabase
      .from('user_bank_challenges')
      .select('order_index')
      .eq('section_id', sectionId)
      .order('order_index', { ascending: false })
      .limit(1);
    
    let nextOrder = (existing?.[0]?.order_index || 0) + 1;

    // 准备批量插入数据
    const insertData = (challenges || []).map((c: any) => ({
      id: c.id || `challenge-${Date.now()}-${nextOrder}`,
      section_id: sectionId,
      type: c.type,
      question: c.question,
      correct_answer: c.correct_answer || c.correctAnswer,
      options: c.options,
      explanation: c.explanation,
      image_url: c.image_url || c.imageUrl,
      order_index: nextOrder++
    }));

    const { data, error } = await supabase
      .from('user_bank_challenges')
      .insert(insertData)
      .select();

    if (error) throw error;

    res.json({ data: data || [], count: insertData.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 23. PUT /api/user/challenges/:id - 更新题目
app.put('/api/user/challenges/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { type, question, correct_answer, options, explanation, image_url, order_index } = req.body;

    // 验证题目属于当前用户的题库
    const { data: challenge, error: challengeError } = await supabase
      .from('user_bank_challenges')
      .select('section_id')
      .eq('id', id)
      .single();

    if (challengeError || !challenge) {
      return res.status(404).json({ error: '题目不存在' });
    }

    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', challenge.section_id)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此题目' });
    }

    const updateData: any = {};
    if (type !== undefined) updateData.type = type;
    if (question !== undefined) updateData.question = question;
    if (correct_answer !== undefined) updateData.correct_answer = correct_answer;
    if (options !== undefined) updateData.options = options;
    if (explanation !== undefined) updateData.explanation = explanation;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (order_index !== undefined) updateData.order_index = order_index;

    const { data, error } = await supabase
      .from('user_bank_challenges')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({ data });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 24. DELETE /api/user/challenges/:id - 删除题目
app.delete('/api/user/challenges/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;

    // 验证题目属于当前用户的题库
    const { data: challenge, error: challengeError } = await supabase
      .from('user_bank_challenges')
      .select('section_id')
      .eq('id', id)
      .single();

    if (challengeError || !challenge) {
      return res.status(404).json({ error: '题目不存在' });
    }

    const { data: section, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('bank_id')
      .eq('id', challenge.section_id)
      .single();

    if (sectionError || !section) {
      return res.status(404).json({ error: '章节不存在' });
    }

    const { data: bank, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .eq('id', section.bank_id)
      .eq('user_id', userId)
      .single();

    if (bankError || !bank) {
      return res.status(403).json({ error: '无权访问此题目' });
    }

    const { error } = await supabase
      .from('user_bank_challenges')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 25. DELETE /api/user/challenges/batch - 批量删除题目
app.post('/api/user/challenges/batch-delete', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { ids } = req.body;

    if (!ids || ids.length === 0) {
      return res.status(400).json({ error: '请提供要删除的题目ID' });
    }

    // 验证所有题目都属于当前用户
    const { data: challenges, error: challengeError } = await supabase
      .from('user_bank_challenges')
      .select('id, section_id')
      .in('id', ids);

    if (challengeError) throw challengeError;

    const sectionIds = [...new Set((challenges || []).map(c => c.section_id))];
    
    const { data: sections, error: sectionError } = await supabase
      .from('user_bank_sections')
      .select('id, bank_id')
      .in('id', sectionIds);

    if (sectionError) throw sectionError;

    const bankIds = [...new Set((sections || []).map(s => s.bank_id))];

    const { data: banks, error: bankError } = await supabase
      .from('user_question_banks')
      .select('id')
      .in('id', bankIds)
      .eq('user_id', userId);

    if (bankError) throw bankError;

    if (!banks || banks.length !== bankIds.length) {
      return res.status(403).json({ error: '部分题目无权访问' });
    }

    const { error } = await supabase
      .from('user_bank_challenges')
      .delete()
      .in('id', ids);

    if (error) throw error;

    res.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 用户知识库
app.get('/api/user/knowledge-base', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { data, error } = await supabase
      .from('user_knowledge_base')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ data: data || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/knowledge-base', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id, title, content, type, imageData, tags } = req.body;
    const { error } = await supabase
      .from('user_knowledge_base')
      .insert({
        id,
        user_id: userId,
        title,
        content,
        type,
        image_data: imageData,
        tags,
        created_at: Date.now(),
        updated_at: Date.now()
      });
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user/knowledge-base/:id', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    const { error } = await supabase
      .from('user_knowledge_base')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 用户 AI 设置
app.get('/api/user/ai-settings', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { data, error } = await supabase
      .from('user_ai_settings')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    res.json({ data: data || null });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/ai-settings', verifyToken, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const payload = { ...req.body, user_id: userId, updated_at: new Date().toISOString() };
    const { error } = await supabase
      .from('user_ai_settings')
      .upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// All other GET requests not handled before will return our React app
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
