import { supabase } from './supabase';
import { Unit, UserProgress, KnowledgeItem, Lesson } from './types';

// API Base URL (从环境变量读取，默认本地)
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// --- Helper: Get Authorization Header ---
const getAuthHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No authentication token available');
  }
  return {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  };
};

// --- Lightweight Unit type for outline (no challenges) ---
export interface LessonOutline {
  id: string;
  title: string;
  completed: boolean;
  locked: boolean;
  stars: number;
  challengeCount: number;
}

export interface UnitOutline {
  id: string;
  title: string;
  description: string;
  color: string;
  lessons: LessonOutline[];
}

// --- Data Fetching API ---

export const apiClient = {
  // ============================================
  // DEPRECATED: V1 Units API (these methods are kept for backward compatibility)
  // Use apiClientV2 methods instead for normalized schema operations
  // ============================================

  // Units (Curriculum) - Full data (for admin)
  // DEPRECATED: Use apiClientV2.fetchUnitsOutline() instead
  async fetchUnits(): Promise<Unit[] | null> {
    console.warn('apiClient.fetchUnits() is deprecated. Use apiClientV2.fetchUnitsOutline() instead.');
    try {
      const response = await fetch(`${API_URL}/units`);
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch units:', error);
      throw error;
    }
  },

  // Units Outline - Lightweight (for user, fast loading)
  // DEPRECATED: Use apiClientV2.fetchUnitsOutline() instead
  async fetchUnitsOutline(): Promise<UnitOutline[] | null> {
    console.warn('apiClient.fetchUnitsOutline() is deprecated. Use apiClientV2.fetchUnitsOutline() instead.');
    try {
      const response = await fetch(`${API_URL}/units/outline`);
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch units outline:', error);
      throw error;
    }
  },

  // Lesson cache for preloading
  _lessonCache: new Map<string, { data: Lesson; timestamp: number }>(),
  _CACHE_TTL: 5 * 60 * 1000, // 5 minutes

  // Fetch specific lesson with challenges (on-demand, with caching)
  // DEPRECATED: Use apiClientV2.fetchChallenges(lessonId) instead
  async fetchLesson(unitId: string, lessonId: string): Promise<Lesson | null> {
    console.warn('apiClient.fetchLesson() is deprecated. Use apiClientV2.fetchChallenges() instead.');
    const cacheKey = `${unitId}:${lessonId}`;
    const cached = this._lessonCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this._CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await fetch(`${API_URL}/units/${unitId}/lessons/${lessonId}`);
      if (!response.ok) {
        throw new Error('Lesson not found');
      }
      const { data } = await response.json();
      
      // Cache the result
      if (data) {
        this._lessonCache.set(cacheKey, { data, timestamp: Date.now() });
      }
      
      return data;
    } catch (error) {
      console.error('Failed to fetch lesson:', error);
      throw error;
    }
  },

  // DEPRECATED: This endpoint no longer works. Use apiClientV2 methods to update individual items.
  async updateUnits(units: Unit[]): Promise<void> {
    console.error('apiClient.updateUnits() is deprecated and no longer works.');
    throw new Error('This method is deprecated. Use apiClientV2.updateUnit/updateLesson/updateChallenge instead.');
  },

  // User Progress
  async fetchUserProgress(): Promise<UserProgress | null> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/user/progress`, headers);

      if (!response.ok) {
        throw new Error('Failed to fetch user progress');
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch user progress:', error);
      throw error;
    }
  },

  async updateUserProgress(progress: UserProgress): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/user/progress`, {
        method: 'POST',
        ...headers,
        body: JSON.stringify({ progress })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update user progress');
      }
    } catch (error) {
      console.error('Failed to update user progress:', error);
      throw error;
    }
  },

  // Initialize User (First Time)
  async initializeUser(): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/init-user`, {
        method: 'POST',
        ...headers,
        body: JSON.stringify({})
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initialize user');
      }
    } catch (error) {
      console.error('Failed to initialize user:', error);
      throw error;
    }
  },

  // Knowledge Base (Admin only)
  async fetchKnowledgeBase(): Promise<KnowledgeItem[]> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/knowledge-base`, headers);
      const { data } = await response.json();

      return (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type as 'text' | 'image',
        imageData: item.image_data,
        createdAt: parseInt(item.created_at) || Date.now()
      }));
    } catch (error) {
      console.error('Failed to fetch knowledge base:', error);
      throw error;
    }
  },

  async addKnowledgeItem(item: KnowledgeItem): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/knowledge-base`, {
        method: 'POST',
        ...headers,
        body: JSON.stringify({
          id: item.id,
          title: item.title,
          content: item.content,
          type: item.type,
          imageData: item.imageData
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add knowledge item');
      }
    } catch (error) {
      console.error('Failed to add knowledge item:', error);
      throw error;
    }
  },

  async deleteKnowledgeItem(id: string): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/knowledge-base/${id}`, {
        method: 'DELETE',
        ...headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete knowledge item');
      }
    } catch (error) {
      console.error('Failed to delete knowledge item:', error);
      throw error;
    }
  },

  // User Knowledge Base
  async fetchUserKnowledgeBase(): Promise<KnowledgeItem[]> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/knowledge-base`, headers);
    if (!response.ok) throw new Error('Failed to fetch user knowledge base');
    const { data } = await response.json();
    return (data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      content: item.content,
      type: item.type,
      imageData: item.image_data,
      createdAt: parseInt(item.created_at) || Date.now()
    }));
  },

  async addUserKnowledgeItem(item: KnowledgeItem): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/knowledge-base`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({
        id: item.id,
        title: item.title,
        content: item.content,
        type: item.type,
        imageData: item.imageData
      })
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to add user knowledge item');
    }
  },

  async deleteUserKnowledgeItem(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/knowledge-base/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete user knowledge item');
    }
  },

  // User AI Settings
  async getUserAISettings(): Promise<any | null> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/user/ai-settings`, headers);
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Server returned non-JSON response:', text.substring(0, 200));
        throw new Error('Server returned non-JSON response');
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch user AI settings: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const { data } = await response.json();
      return data || null;
    } catch (error: any) {
      // Re-throw with additional context
      if (error.message.includes('No authentication token available')) {
        throw new Error('User not authenticated');
      }
      throw error;
    }
  },

  async updateUserAISettings(config: any): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/user/ai-settings`, {
        method: 'PUT',
        ...headers,
        body: JSON.stringify(config)
      });
      
      if (!response.ok) {
        // Try to parse error response
        let errorMessage = `Failed to update user AI settings: ${response.status} ${response.statusText}`;
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          }
        } catch {
          // Ignore JSON parsing errors for error response
        }
        throw new Error(errorMessage);
      }
    } catch (error: any) {
      // Re-throw with additional context
      if (error.message.includes('No authentication token available')) {
        throw new Error('User not authenticated');
      }
      throw error;
    }
  },

  // Admin Management
  async fetchAdmins() {
    try {
      const response = await fetch(`${API_URL}/admins`);
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch admins:', error);
      throw error;
    }
  },

  async addAdmin(email: string): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/admins`, {
        method: 'POST',
        ...headers,
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add admin');
      }
    } catch (error) {
      console.error('Failed to add admin:', error);
      throw error;
    }
  },

  async deleteAdmin(email: string): Promise<void> {
    try {
      const headers = await getAuthHeader();
      const response = await fetch(`${API_URL}/admins/${email}`, {
        method: 'DELETE',
        ...headers
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete admin');
      }
    } catch (error) {
      console.error('Failed to delete admin:', error);
      throw error;
    }
  },

  // Leaderboard
  async fetchLeaderboard() {
    try {
      const response = await fetch(`${API_URL}/leaderboard`);
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      throw error;
    }
  },

  // --- AI API Methods (via Backend) ---

  // Generate quiz questions from content
  async generateQuestions(content: string, systemPrompt: string, config: any): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, systemPrompt, config })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate questions');
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to generate questions:', error);
      throw error;
    }
  },

  // Generate structured curriculum
  async generateStructure(content: string, systemPrompt: string, config: any): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/ai/generate-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, systemPrompt, config })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate structure');
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to generate structure:', error);
      throw error;
    }
  },

  // Generate additional options for a question
  async generateOptions(question: string, correctAnswer: string, count: number, config: any): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/ai/generate-options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, correctAnswer, count, config })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate options');
      }

      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to generate options:', error);
      throw error;
    }
  },

  // Test AI connection
  async testAIConnection(config: any): Promise<{ success: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_URL}/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });

      const result = await response.json();
      return result;
    } catch (error: any) {
      console.error('AI test failed:', error);
      return { success: false, message: error.message };
    }
  },

  // Stream AI response (returns async generator)
  async *streamAI(prompt: string, systemPrompt: string, config: any): AsyncGenerator<string> {
    const response = await fetch(`${API_URL}/ai/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, systemPrompt, config })
    });

    if (!response.ok) {
      throw new Error('Stream request failed');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) yield parsed.text;
          } catch {
            // Ignore parse errors for partial chunks
          }
        }
      }
    }
  },

  // --- Task-based AI Generation (Backend Processing) ---

  // Create a task for generating questions (runs in backend, not blocking UI)
  async createGenerateQuestionsTask(
    userId: string,
    content: string, 
    systemPrompt: string, 
    config: any,
    title?: string
  ): Promise<{ taskId: string }> {
    try {
      const response = await fetch(`${API_URL}/ai/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content, 
          systemPrompt, 
          config,
          userId,
          useTask: true,
          title: title || '生成题目'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      const { taskId } = await response.json();
      return { taskId };
    } catch (error) {
      console.error('Failed to create generate questions task:', error);
      throw error;
    }
  },

  // Create a task for generating structured curriculum (runs in backend)
  async createGenerateStructureTask(
    userId: string,
    content: string, 
    systemPrompt: string, 
    config: any,
    title?: string
  ): Promise<{ taskId: string }> {
    try {
      const response = await fetch(`${API_URL}/ai/generate-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content, 
          systemPrompt, 
          config,
          userId,
          useTask: true,
          title: title || '生成课程结构'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      const { taskId } = await response.json();
      return { taskId };
    } catch (error) {
      console.error('Failed to create generate structure task:', error);
      throw error;
    }
  },

  // Get task status and result
  async getTask(taskId: string): Promise<any> {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`);
      if (!response.ok) {
        throw new Error('Task not found');
      }
      const { data } = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get task:', error);
      throw error;
    }
  },

  // Cancel a running task
  async cancelTask(taskId: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (!response.ok) {
        throw new Error('Failed to cancel task');
      }
    } catch (error) {
      console.error('Failed to cancel task:', error);
      throw error;
    }
  }
};

// ============================================
// API v2 - 新的数据结构
// ============================================

const API_V2_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace('/api', '')}/api/v2`
  : 'http://localhost:5000/api/v2';

// --- Types for v2 ---
export interface UnitV2 {
  id: string;
  title: string;
  description?: string;
  color: string;
  order_index: number;
  created_at?: string;
  updated_at?: string;
}

export interface LessonV2 {
  id: string;
  unit_id: string;
  title: string;
  order_index: number;
  challengeCount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface ChallengeV2 {
  id: string;
  lesson_id: string;
  type: string;
  question: string;
  correct_answer: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  image_url?: string;
  order_index: number;
}

export interface SnapshotSummary {
  id: number;
  snapshot_type: string;
  description: string;
  created_by: string;
  created_at: string;
}

export interface SnapshotDetail extends SnapshotSummary {
  data: {
    units: UnitV2[];
    lessons: LessonV2[];
    challenges: ChallengeV2[];
    snapshot_time: string;
  };
}

export const apiClientV2 = {
  // ============================================
  // Units
  // ============================================
  
  async fetchUnitsOutline(): Promise<(UnitV2 & { lessons: LessonV2[] })[]> {
    const response = await fetch(`${API_V2_URL}/units/outline`);
    if (!response.ok) throw new Error('Failed to fetch units outline');
    const { data } = await response.json();
    return data || [];
  },

  async createUnit(unit: Partial<UnitV2>): Promise<UnitV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/units`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify(unit)
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create unit');
    }
    const { data } = await response.json();
    return data;
  },

  async updateUnit(id: string, unit: Partial<UnitV2>): Promise<UnitV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/units/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(unit)
    });
    if (!response.ok) throw new Error('Failed to update unit');
    const { data } = await response.json();
    return data;
  },

  async deleteUnit(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/units/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('Failed to delete unit');
  },

  // ============================================
  // Lessons
  // ============================================
  
  async fetchLesson(id: string): Promise<LessonV2 & { challenges: ChallengeV2[] }> {
    const response = await fetch(`${API_V2_URL}/lessons/${id}`);
    if (!response.ok) throw new Error('Failed to fetch lesson');
    const { data } = await response.json();
    return data;
  },

  async createLesson(lesson: { unit_id: string; title: string }): Promise<LessonV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/lessons`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify(lesson)
    });
    if (!response.ok) throw new Error('Failed to create lesson');
    const { data } = await response.json();
    return data;
  },

  async updateLesson(id: string, lesson: Partial<LessonV2>): Promise<LessonV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/lessons/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(lesson)
    });
    if (!response.ok) throw new Error('Failed to update lesson');
    const { data } = await response.json();
    return data;
  },

  async deleteLesson(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/lessons/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('Failed to delete lesson');
  },

  // ============================================
  // Challenges
  // ============================================
  
  async fetchChallenges(lessonId: string): Promise<ChallengeV2[]> {
    const response = await fetch(`${API_V2_URL}/challenges?lesson_id=${lessonId}`);
    if (!response.ok) throw new Error('Failed to fetch challenges');
    const { data } = await response.json();
    return data || [];
  },

  async createChallenge(challenge: Omit<ChallengeV2, 'order_index'>): Promise<ChallengeV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/challenges`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify(challenge)
    });
    if (!response.ok) throw new Error('Failed to create challenge');
    const { data } = await response.json();
    return data;
  },

  async createChallengesBatch(lessonId: string, challenges: any[]): Promise<{ count: number }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/challenges/batch`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ lesson_id: lessonId, challenges })
    });
    if (!response.ok) throw new Error('Failed to create challenges');
    const result = await response.json();
    return { count: result.count };
  },

  async updateChallenge(id: string, challenge: Partial<ChallengeV2>): Promise<ChallengeV2> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/challenges/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(challenge)
    });
    if (!response.ok) throw new Error('Failed to update challenge');
    const { data } = await response.json();
    return data;
  },

  async deleteChallenge(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/challenges/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('Failed to delete challenge');
  },

  // ============================================
  // Snapshots (备份/恢复)
  // ============================================
  
  async fetchSnapshots(limit = 20): Promise<SnapshotSummary[]> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/snapshots?limit=${limit}`, headers);
    if (!response.ok) throw new Error('Failed to fetch snapshots');
    const { data } = await response.json();
    return data || [];
  },

  async fetchSnapshotDetail(id: number): Promise<SnapshotDetail> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/snapshots/${id}`, headers);
    if (!response.ok) throw new Error('Failed to fetch snapshot');
    const { data } = await response.json();
    return data;
  },

  async createSnapshot(description?: string): Promise<{ snapshotId: number }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/snapshots`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ description })
    });
    if (!response.ok) throw new Error('Failed to create snapshot');
    return await response.json();
  },

  async restoreSnapshot(id: number): Promise<{ units: number; lessons: number; challenges: number }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_V2_URL}/snapshots/${id}/restore`, {
      method: 'POST',
      ...headers
    });
    if (!response.ok) throw new Error('Failed to restore snapshot');
    const { restored } = await response.json();
    return restored;
  }
};

// ============================================
// 用户私人题库 API (User Question Banks)
// ============================================

export interface UserQuestionBank {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  color: string;
  icon: string;
  is_public: boolean;
  order_index: number;
  created_at?: string;
  updated_at?: string;
  sections?: UserBankSection[];
  totalChallenges?: number;
}

export interface UserBankSection {
  id: string;
  bank_id: string;
  title: string;
  order_index: number;
  challengeCount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UserBankChallenge {
  id: string;
  section_id: string;
  type: string;
  question: string;
  correct_answer: string;
  options?: { id: string; text: string }[];
  explanation?: string;
  image_url?: string;
  order_index: number;
}

export const userBankApi = {
  // ============================================
  // 题库操作
  // ============================================
  
  async fetchBanks(): Promise<UserQuestionBank[]> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/banks`, headers);
    if (!response.ok) throw new Error('获取题库列表失败');
    const { data } = await response.json();
    return data || [];
  },

  async createBank(bank: { title: string; description?: string; color?: string; icon?: string }): Promise<UserQuestionBank> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/banks`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ 
        id: `bank-${Date.now()}`,
        ...bank 
      })
    });
    if (!response.ok) throw new Error('创建题库失败');
    const { data } = await response.json();
    return data;
  },

  async updateBank(id: string, updates: Partial<UserQuestionBank>): Promise<UserQuestionBank> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/banks/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('更新题库失败');
    const { data } = await response.json();
    return data;
  },

  async deleteBank(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/banks/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('删除题库失败');
  },

  // ============================================
  // 章节操作
  // ============================================
  
  async createSection(bankId: string, title: string): Promise<UserBankSection> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/banks/${bankId}/sections`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ 
        id: `section-${Date.now()}`,
        title 
      })
    });
    if (!response.ok) throw new Error('创建章节失败');
    const { data } = await response.json();
    return data;
  },

  async updateSection(id: string, updates: { title?: string; order_index?: number }): Promise<UserBankSection> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/sections/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('更新章节失败');
    const { data } = await response.json();
    return data;
  },

  async deleteSection(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/sections/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('删除章节失败');
  },

  // ============================================
  // 题目操作
  // ============================================
  
  async fetchChallenges(sectionId: string): Promise<UserBankChallenge[]> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/sections/${sectionId}/challenges`, headers);
    if (!response.ok) throw new Error('获取题目失败');
    const { data } = await response.json();
    return data || [];
  },

  async createChallenge(sectionId: string, challenge: Omit<UserBankChallenge, 'id' | 'section_id' | 'order_index'>): Promise<UserBankChallenge> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/sections/${sectionId}/challenges`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({
        id: `challenge-${Date.now()}`,
        ...challenge
      })
    });
    if (!response.ok) throw new Error('添加题目失败');
    const { data } = await response.json();
    return data;
  },

  async createChallengesBatch(sectionId: string, challenges: any[]): Promise<{ count: number }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/sections/${sectionId}/challenges/batch`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ challenges })
    });
    if (!response.ok) throw new Error('批量添加题目失败');
    const { data, count } = await response.json();
    return { count };
  },

  async updateChallenge(id: string, updates: Partial<UserBankChallenge>): Promise<UserBankChallenge> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/challenges/${id}`, {
      method: 'PUT',
      ...headers,
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('更新题目失败');
    const { data } = await response.json();
    return data;
  },

  async deleteChallenge(id: string): Promise<void> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/challenges/${id}`, {
      method: 'DELETE',
      ...headers
    });
    if (!response.ok) throw new Error('删除题目失败');
  },

  async deleteChallengesBatch(ids: string[]): Promise<{ deleted: number }> {
    const headers = await getAuthHeader();
    const response = await fetch(`${API_URL}/user/challenges/batch-delete`, {
      method: 'POST',
      ...headers,
      body: JSON.stringify({ ids })
    });
    if (!response.ok) throw new Error('批量删除题目失败');
    const result = await response.json();
    return { deleted: result.deleted || ids.length };
  }
};
