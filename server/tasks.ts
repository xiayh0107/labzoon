import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Task status types
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  user_id: string;
  type: 'generate_questions' | 'generate_structure' | 'generate_image' | 'batch_generate';
  status: TaskStatus;
  title: string;
  progress: number; // 0-100
  result?: any;
  error?: string;
  input_summary?: string; // Brief description of input
  created_at: number;
  started_at?: number;
  completed_at?: number;
  metadata?: Record<string, any>;
}

// In-memory task storage (for running tasks)
const runningTasks = new Map<string, Task>();

// Get Supabase client from environment
const getSupabase = () => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  return createClient(supabaseUrl, supabaseServiceKey);
};

// --- Helper: Generate Task ID ---
const generateTaskId = () => {
  return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// --- Helper: Save task to database ---
const saveTaskToDb = async (task: Task) => {
  const supabase = getSupabase();
  
  try {
    const { error } = await supabase
      .from('ai_tasks')
      .upsert({
        id: task.id,
        user_id: task.user_id,
        type: task.type,
        status: task.status,
        title: task.title,
        progress: task.progress,
        result: task.result,
        error: task.error,
        input_summary: task.input_summary,
        created_at: task.created_at,
        started_at: task.started_at,
        completed_at: task.completed_at,
        metadata: task.metadata
      });

    if (error) {
      console.error('Failed to save task to DB:', error);
    }
  } catch (e) {
    console.error('Error saving task:', e);
  }
};

// --- Route: POST /api/tasks - Create a new task ---
router.post('/', async (req, res) => {
  try {
    const { type, title, input_summary, metadata, user_id } = req.body;

    if (!type || !title || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const task: Task = {
      id: generateTaskId(),
      user_id,
      type,
      status: 'pending',
      title,
      progress: 0,
      input_summary,
      created_at: Date.now(),
      metadata
    };

    // Store in memory
    runningTasks.set(task.id, task);
    
    // Save to database
    await saveTaskToDb(task);

    res.json({ success: true, task });
  } catch (error: any) {
    console.error('Create task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Route: GET /api/tasks - List tasks for a user ---
router.get('/', async (req, res) => {
  try {
    const { user_id, status, limit = 20 } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const supabase = getSupabase();
    
    let query = supabase
      .from('ai_tasks')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(Number(limit));

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Merge with running tasks (in case DB hasn't synced yet)
    const tasks = data || [];
    const runningTasksList = Array.from(runningTasks.values())
      .filter(t => t.user_id === user_id);

    // Merge and dedupe
    const taskMap = new Map<string, Task>();
    tasks.forEach(t => taskMap.set(t.id, t));
    runningTasksList.forEach(t => taskMap.set(t.id, t)); // Running tasks take priority

    const mergedTasks = Array.from(taskMap.values())
      .sort((a, b) => b.created_at - a.created_at);

    res.json({ data: mergedTasks });
  } catch (error: any) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Route: GET /api/tasks/:id - Get a specific task ---
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check in-memory first
    if (runningTasks.has(id)) {
      return res.json({ data: runningTasks.get(id) });
    }

    // Check database
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('ai_tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found' });
      }
      throw error;
    }

    res.json({ data });
  } catch (error: any) {
    console.error('Get task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Route: PATCH /api/tasks/:id - Update task status ---
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, progress, result, error: taskError } = req.body;

    // Get existing task
    let task = runningTasks.get(id);
    
    if (!task) {
      // Try to get from database
      const supabase = getSupabase();
      const { data } = await supabase
        .from('ai_tasks')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        task = data as Task;
        runningTasks.set(id, task);
      }
    }

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Update task
    if (status) task.status = status;
    if (progress !== undefined) task.progress = progress;
    if (result !== undefined) task.result = result;
    if (taskError !== undefined) task.error = taskError;

    // Set timestamps
    if (status === 'running' && !task.started_at) {
      task.started_at = Date.now();
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      task.completed_at = Date.now();
      // Remove from running tasks after a delay
      setTimeout(() => runningTasks.delete(id), 60000);
    }

    // Update in memory
    runningTasks.set(id, task);
    
    // Save to database
    await saveTaskToDb(task);

    res.json({ success: true, task });
  } catch (error: any) {
    console.error('Update task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Route: DELETE /api/tasks/:id - Cancel a task ---
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const task = runningTasks.get(id);
    
    if (task) {
      task.status = 'cancelled';
      task.completed_at = Date.now();
      runningTasks.delete(id);
      await saveTaskToDb(task);
    } else {
      // Update in database directly
      const supabase = getSupabase();
      await supabase
        .from('ai_tasks')
        .update({ status: 'cancelled', completed_at: Date.now() })
        .eq('id', id);
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('Cancel task error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Route: GET /api/tasks/running/count - Get running task count ---
router.get('/running/count', async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const count = Array.from(runningTasks.values())
      .filter(t => t.user_id === user_id && (t.status === 'pending' || t.status === 'running'))
      .length;

    res.json({ count });
  } catch (error: any) {
    console.error('Get running count error:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Export helpers for AI routes to use ---
export const taskManager = {
  createTask: async (userId: string, type: Task['type'], title: string, inputSummary?: string, metadata?: any): Promise<Task> => {
    const task: Task = {
      id: generateTaskId(),
      user_id: userId,
      type,
      status: 'pending',
      title,
      progress: 0,
      input_summary: inputSummary,
      created_at: Date.now(),
      metadata
    };
    
    runningTasks.set(task.id, task);
    await saveTaskToDb(task);
    return task;
  },

  updateTask: async (taskId: string, updates: Partial<Task>) => {
    const task = runningTasks.get(taskId);
    if (!task) return null;

    Object.assign(task, updates);
    
    if (updates.status === 'running' && !task.started_at) {
      task.started_at = Date.now();
    }
    if (updates.status === 'completed' || updates.status === 'failed') {
      task.completed_at = Date.now();
    }

    runningTasks.set(taskId, task);
    await saveTaskToDb(task);
    return task;
  },

  getTask: (taskId: string) => runningTasks.get(taskId),

  isTaskCancelled: (taskId: string) => {
    const task = runningTasks.get(taskId);
    return task?.status === 'cancelled';
  }
};

export default router;
