
import React, { useState, useEffect } from 'react';
import { Heart, Zap, BookOpen, Trash2, AlertCircle, Loader2, LogOut, Cloud, CheckCircle2, Database, Terminal, Copy } from 'lucide-react';
import { Unit, UserProgress, KnowledgeItem, Challenge } from './types';
import { INITIAL_UNITS } from './constants';
import { supabase } from './supabase';
import { apiClient, apiClientV2 } from './apiClient';
import { Session } from '@supabase/supabase-js';

// Imported modular components
import Sidebar from './components/Sidebar';
import UnitPath from './components/UnitPath';
import LessonSession from './components/LessonSession';
import AdminPanel from './components/AdminPanel';
import AuthScreen from './components/AuthScreen';
import Leaderboard from './components/Leaderboard';
import TaskManager from './components/TaskManager';
import UserQuestionBanks from './components/UserQuestionBanks';

import PersonalPanel from './components/PersonalPanel';

const GLOBAL_UNITS_ID = 'global-units';


// --- SQL Script for User Convenience (v2 Schema) ---
const REQUIRED_SQL = `
-- LabZoon Database Schema v2
-- 运行此脚本初始化数据库

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

-- 3. 题目表 (Challenges)
CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    question TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    options JSONB,
    explanation TEXT,
    image_url TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 用户进度表
CREATE TABLE IF NOT EXISTS user_progress (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    data JSONB
);

-- 5. 知识库表
CREATE TABLE IF NOT EXISTS knowledge_base (
    id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    type TEXT,
    image_data TEXT,
    created_at BIGINT
);

-- 6. 管理员表
CREATE TABLE IF NOT EXISTS app_admins (
    email TEXT PRIMARY KEY,
    created_at BIGINT
);

-- 启用 RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_admins ENABLE ROW LEVEL SECURITY;

-- 公开读取策略
CREATE POLICY IF NOT EXISTS "Public read" ON units FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON lessons FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON challenges FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON knowledge_base FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "Public read" ON app_admins FOR SELECT USING (true);

-- 用户进度策略
CREATE POLICY IF NOT EXISTS "Read all progress" ON user_progress FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY IF NOT EXISTS "Insert own progress" ON user_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY IF NOT EXISTS "Update own progress" ON user_progress FOR UPDATE USING (auth.uid() = user_id);

-- 初始管理员
INSERT INTO app_admins (email, created_at) VALUES ('admin@labzoon.com', 1716300000000) ON CONFLICT DO NOTHING;
`;

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // App Data State
  const [activeTab, setActiveTab] = useState('learn');
  const [dataLoading, setDataLoading] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false); // Track if initial outline is loaded
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress>({ 
      hearts: 5, xp: 0, streak: 1, completedLessonIds: [], email: '' 
  });

  const [currentSession, setCurrentSession] = useState<{unitId: string, lessonId: string} | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // 用户题库练习状态
  const [userBankPractice, setUserBankPractice] = useState<{
    bankId: string;
    sectionId: string;
    challenges: Challenge[];
  } | null>(null);
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dbMissing, setDbMissing] = useState(false);

  // Toast 通知状态
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  
  // 显示 Toast 通知
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info', title?: string) => {
    setToast({ message, type, title });
  };

  // 自动关闭 Toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // --- 1. Auth & Session Management ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- 2. Check Admin Status ---
  useEffect(() => {
    const checkAdmin = async () => {
        if (!session?.user?.email) {
            setIsAdmin(false);
            return;
        }

        // --- HARDCODED SUPER ADMIN CHECK ---
        if (session.user.email === 'admin@labzoon.com') {
            setIsAdmin(true);
            return; 
        }
        
        // Check DB via API for admin email
        try {
            const admins = await apiClient.fetchAdmins();
            const isAdminUser = admins.some((admin: any) => admin.email === session.user.email);
            setIsAdmin(isAdminUser);
            if (!isAdminUser && activeTab === 'admin') setActiveTab('learn');
        } catch (error) {
            console.error('Failed to check admin status:', error);
            setIsAdmin(false);
        }
    };
    
    if (session) {
        checkAdmin();
    }
  }, [session, activeTab]);

  // --- 3. Data Fetching & Initialization ---
  useEffect(() => {
    if (!session) return;

    const fetchAllData = async () => {
        // Only show full-screen loading on very first load
        if (!initialDataLoaded) {
            setDataLoading(true);
        }
        setDbMissing(false);
        try {
            // Fetch lightweight outline first using v2 API
            const outlineData = await apiClientV2.fetchUnitsOutline();
            
            // Convert v2 format to Unit format for display
            const unitsFromOutline: Unit[] = (outlineData || []).map((unit: any) => ({
                ...unit,
                lessons: (unit.lessons || []).map((lesson: any) => ({
                    ...lesson,
                    completed: false,
                    locked: false,
                    stars: 0,
                    challenges: [] // Challenges loaded on-demand when user starts lesson
                }))
            }));
            setUnits(unitsFromOutline);
            // Mark initial load complete immediately after outline loads
            setInitialDataLoaded(true);
            setDataLoading(false);

            // Fetch User Progress via API - errors here should not block the app
            try {
                const progressData = await apiClient.fetchUserProgress();
                if (progressData) {
                    setUserProgress({ ...progressData, email: session.user.email });
                } else {
                    // First time user - initialize
                    const defaultProgress = { 
                        hearts: 5, 
                        xp: 0, 
                        streak: 1, 
                        completedLessonIds: [],
                        email: session.user.email 
                    };
                    try {
                        await apiClient.initializeUser();
                    } catch (e) {
                        console.warn('Failed to initialize user progress:', e);
                    }
                    setUserProgress(defaultProgress);
                }
            } catch (progressError) {
                console.warn('Failed to fetch user progress, using defaults:', progressError);
                setUserProgress({ 
                    hearts: 5, 
                    xp: 0, 
                    streak: 1, 
                    completedLessonIds: [],
                    email: session.user.email 
                });
            }

            // Knowledge Base is NOT loaded on initial page load
            // It will be loaded when user enters admin panel

        } catch (error) {
            console.error("Data fetching error:", error);
            setDbMissing(true);
            setDataLoading(false);
        }
    };

    fetchAllData();
  }, [session]);

  // --- 3.1 Lazy load knowledge base when admin tab is accessed ---
  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      if (knowledgeBase.length === 0) {
        apiClient.fetchKnowledgeBase().then(setKnowledgeBase).catch(console.error);
      }
    } else if (activeTab === 'mybanks') {
      apiClient.fetchUserKnowledgeBase().then(setKnowledgeBase).catch(console.error);
    }
  }, [activeTab, isAdmin]);

  // --- 4. Data Persistence ---

  // Note: Since migrating to v2 schema, we no longer use the old app_units table.
  // Individual saves should use apiClientV2 methods directly.
  // This function now only updates local state.
  const handleSetUnits = (action: React.SetStateAction<Unit[]>) => {
      setUnits((prevUnits) => {
          const newUnits = action instanceof Function ? action(prevUnits) : action;
          return newUnits;
      });
  };

  const handleSetUserProgress = (newProgress: UserProgress) => {
      // Ensure we always save identity info for leaderboard
      const progressToSave = {
          ...newProgress,
          email: session?.user?.email,
          lastActive: Date.now()
      };

      setUserProgress(progressToSave);
      
      if (session?.user?.id && !dbMissing) {
          apiClient.updateUserProgress(progressToSave)
            .catch((error) => {
                console.error("Failed to save progress:", error);
            });
      }
  };

  const handleUpdateKnowledgeBase = async (action: 'add' | 'delete' | 'set', item?: KnowledgeItem, allItems?: KnowledgeItem[]) => {
      if (dbMissing) {
          alert("数据库连接异常，无法保存知识库变更");
          return;
      }
      setSyncStatus('saving');
      try {
          if (action === 'set' && allItems) {
              setKnowledgeBase(allItems);
              setSyncStatus('idle'); 
          }
          else if (action === 'add' && item) {
              setKnowledgeBase(prev => [item, ...prev]);
              // Use different API depending on whether user is admin and which tab is active
              // If in admin tab and is admin -> admin KB
              // If in mybanks tab -> user KB
              if (activeTab === 'admin' && isAdmin) {
                  await apiClient.addKnowledgeItem(item);
              } else {
                  await apiClient.addUserKnowledgeItem(item);
              }
          }
          else if (action === 'delete' && item) {
              setKnowledgeBase(prev => prev.filter(k => k.id !== item.id));
              // Use different API depending on whether user is admin and which tab is active
              if (activeTab === 'admin' && isAdmin) {
                  await apiClient.deleteKnowledgeItem(item.id);
              } else {
                  await apiClient.deleteUserKnowledgeItem(item.id);
              }
          }
          setSyncStatus('saved');
          setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err: any) {
          console.error("Knowledge base DB error:", err);
          setSyncStatus('error');
          alert(`知识库同步失败: ${err.message || '未知错误'}`);
      }
  };

  // --- Handlers ---

  const handleStartLesson = (unitId: string, lessonId: string) => {
    setCurrentSession({ unitId, lessonId });
  };

  const handleLessonComplete = () => {
    if (!currentSession) return;
    
    const isNewCompletion = !userProgress.completedLessonIds.includes(currentSession.lessonId);
    const newProgress = {
        ...userProgress,
        xp: userProgress.xp + 10,
        hearts: userProgress.hearts + 1,
        completedLessonIds: isNewCompletion ? [...userProgress.completedLessonIds, currentSession.lessonId] : userProgress.completedLessonIds
    };
    handleSetUserProgress(newProgress);

    setUnits(prev => {
        const newUnits = [...prev];
        const unitIdx = newUnits.findIndex(u => u.id === currentSession.unitId);
        if (unitIdx !== -1) {
            const unit = { ...newUnits[unitIdx] };
            const lessonIdx = unit.lessons.findIndex(l => l.id === currentSession.lessonId);
            
            if (lessonIdx !== -1) {
                const newLessons = [...unit.lessons];
                newLessons[lessonIdx] = { ...newLessons[lessonIdx], completed: true };
                if (lessonIdx + 1 < newLessons.length) {
                    newLessons[lessonIdx + 1] = { ...newLessons[lessonIdx + 1], locked: false };
                } 
                unit.lessons = newLessons;
                newUnits[unitIdx] = unit;
            }
        }
        return newUnits;
    });

    setCurrentSession(null);
  };

  useEffect(() => {
      if (units.length > 0 && userProgress.completedLessonIds.length > 0) {
          setUnits(prev => prev.map(u => ({
              ...u,
              lessons: u.lessons.map((l, idx) => {
                  const isCompleted = userProgress.completedLessonIds.includes(l.id);
                  let isLocked = l.locked;
                  if (isCompleted) isLocked = false;
                  if (idx > 0) {
                      const prevLessonId = u.lessons[idx - 1].id;
                      if (userProgress.completedLessonIds.includes(prevLessonId)) {
                          isLocked = false;
                      }
                  }
                  return { ...l, completed: isCompleted, locked: isLocked };
              })
          })));
      }
  }, [userProgress.completedLessonIds]); 

  const handleExitLesson = (skipConfirm: boolean | unknown = false) => {
      if (skipConfirm === true) {
          setCurrentSession(null);
      } else {
          setShowExitConfirm(true);
      }
  };

  const handleLogout = async () => {
      await supabase.auth.signOut();
      setSession(null);
      setIsAdmin(false);
      setUserProgress({ hearts: 5, xp: 0, streak: 1, completedLessonIds: [] });
  };

  const copySql = () => {
      navigator.clipboard.writeText(REQUIRED_SQL);
      alert("SQL 脚本已复制到剪贴板！请前往 Supabase SQL Editor 运行。");
  };

  // --- Render ---

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-white"><Loader2 size={48} className="animate-spin text-gray-300" /></div>;
  if (!session) return <AuthScreen />;

  // DB Missing UI
  if (dbMissing) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-6">
              <div className="max-w-3xl w-full bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
                  <div className="flex items-center gap-4 mb-6 text-red-400">
                      <Database size={48} />
                      <div>
                          <h1 className="text-2xl font-bold text-white">数据库未初始化</h1>
                          <p className="text-sm opacity-80">检测到 Supabase 中缺少必要的表结构。</p>
                      </div>
                  </div>
                  
                  <div className="bg-black/50 rounded-xl p-4 mb-6 border border-gray-600 relative group">
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={copySql} className="bg-white text-black px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1 hover:bg-gray-200">
                              <Copy size={12}/> 复制 SQL
                          </button>
                      </div>
                      <code className="text-xs font-mono text-green-400 whitespace-pre-wrap">
                          {REQUIRED_SQL}
                      </code>
                  </div>

                  <div className="flex gap-4">
                      <button onClick={copySql} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                          <Terminal size={18} /> 复制脚本
                      </button>
                      <button onClick={() => window.location.reload()} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-bold transition-all">
                          已运行脚本，刷新页面
                      </button>
                  </div>
                  
                  <p className="mt-6 text-center text-xs text-gray-500">
                      请前往 Supabase Dashboard -&gt; SQL Editor -&gt; New Query 粘贴并运行上述脚本。
                  </p>
              </div>
          </div>
      );
  }

  if (dataLoading) {
      return (
          <div className="min-h-screen flex flex-col bg-white">
              {/* Skeleton Header */}
              <div className="bg-white px-6 py-4 flex justify-between items-center border-b border-gray-100">
                  <div className="flex gap-6">
                      <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-8 h-5 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                      <div className="flex items-center gap-2">
                          <div className="w-5 h-5 bg-gray-200 rounded animate-pulse"></div>
                          <div className="w-6 h-5 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                      <Loader2 size={14} className="animate-spin" />
                      <span>同步中...</span>
                  </div>
              </div>
              
              {/* Skeleton Content */}
              <div className="flex-1 p-8 max-w-lg mx-auto w-full">
                  <div className="space-y-6">
                      {[1, 2, 3].map(i => (
                          <div key={i} className="animate-pulse">
                              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                              <div className="flex gap-4">
                                  {[1, 2, 3].map(j => (
                                      <div key={j} className="w-16 h-16 bg-gray-200 rounded-full"></div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      );
  }

  if (currentSession) {
      const unit = units.find(u => u.id === currentSession.unitId);
      const lesson = unit?.lessons.find(l => l.id === currentSession.lessonId);
      if (lesson) {
          return (
            <>
                <LessonSession 
                    lesson={lesson} 
                    unitId={currentSession.unitId}
                    onComplete={handleLessonComplete} 
                    onExit={handleExitLesson} 
                />
                {showExitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                        <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
                            <div className="flex items-center gap-2 mb-2 text-red-500">
                                <AlertCircle />
                                <h3 className="text-lg font-bold text-gray-800">确定要退出吗？</h3>
                            </div>
                            <p className="text-gray-600 mb-6 text-sm">正在进行的课程进度将不会保存。</p>
                            <div className="flex gap-3 justify-end">
                                <button onClick={() => setShowExitConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">继续学习</button>
                                <button onClick={() => { setCurrentSession(null); setShowExitConfirm(false); }} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg">确认退出</button>
                            </div>
                        </div>
                    </div>
                )}
            </>
          );
      }
  }

  // 用户题库练习模式
  if (userBankPractice) {
    const practiceLesson = {
      id: userBankPractice.sectionId,
      title: '私人题库练习',
      challenges: userBankPractice.challenges,
      completed: false,
      locked: false,
      stars: 0
    };
    
    return (
      <>
        <LessonSession 
          lesson={practiceLesson}
          unitId={userBankPractice.bankId}
          onComplete={() => {
            // 练习完成后返回题库页面
            setUserBankPractice(null);
            setActiveTab('mybanks');
          }}
          onExit={() => {
            setShowExitConfirm(true);
          }}
        />
        {showExitConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 mb-2 text-red-500">
                <AlertCircle />
                <h3 className="text-lg font-bold text-gray-800">确定要退出练习吗？</h3>
              </div>
              <p className="text-gray-600 mb-6 text-sm">当前练习进度不会保存。</p>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowExitConfirm(false)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors">继续练习</button>
                <button onClick={() => { setUserBankPractice(null); setShowExitConfirm(false); setActiveTab('mybanks'); }} className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg">确认退出</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white md:bg-gray-50 text-gray-800 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      
      {/* Task Manager - Only visible to admins */}
      {isAdmin && session?.user?.id && (
        <TaskManager 
          userId={session.user.id} 
          onTaskComplete={async (task) => {
            // 使用 localStorage 持久化已处理的任务 ID，避免重复触发
            const PROCESSED_TASKS_KEY = 'labzoon_processed_tasks';
            const getProcessedTasks = (): Set<string> => {
              try {
                const saved = localStorage.getItem(PROCESSED_TASKS_KEY);
                return saved ? new Set(JSON.parse(saved)) : new Set();
              } catch { return new Set(); }
            };
            const markTaskProcessed = (taskId: string) => {
              const processed = getProcessedTasks();
              processed.add(taskId);
              // 只保留最近 100 个任务 ID
              const arr = Array.from(processed).slice(-100);
              localStorage.setItem(PROCESSED_TASKS_KEY, JSON.stringify(arr));
            };

            // 检查是否已处理过此任务
            if (getProcessedTasks().has(task.id)) {
              console.log('Task already processed, skipping:', task.id);
              return;
            }

            // 任务完成时处理结果
            if (task.type === 'generate_structure' && task.result) {
              // 立即标记为已处理，防止并发重复
              markTaskProcessed(task.id);
              
              // 结构化生成完成，使用 v2 API 保存到数据库
              const newUnits = task.result;
              if (Array.isArray(newUnits) && newUnits.length > 0) {
                try {
                  setSyncStatus('saving');
                  const colors = ['green', 'blue', 'purple', 'orange', 'rose', 'teal', 'yellow', 'indigo'];
                  const timestamp = Date.now();
                  const randomSuffix = Math.random().toString(36).substring(2, 8);
                  let totalLessons = 0;
                  let totalChallenges = 0;

                  for (let uIdx = 0; uIdx < newUnits.length; uIdx++) {
                    const unit = newUnits[uIdx];
                    // 始终生成新的唯一 ID，避免与数据库中已存在的 ID 冲突
                    const unitId = `unit-${timestamp}-${randomSuffix}-${uIdx}`;
                    
                    // 1. 创建单元
                    const createdUnit = await apiClientV2.createUnit({
                      id: unitId,
                      title: unit.title,
                      description: unit.description || 'AI 自动生成',
                      color: unit.color || colors[uIdx % colors.length]
                    });

                    // 2. 为每个单元创建课程和题目
                    const lessons = unit.lessons || [];
                    for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
                      const lesson = lessons[lIdx];
                      
                      // 创建课程，使用创建的单元ID
                      const createdLesson = await apiClientV2.createLesson({
                        unit_id: createdUnit.id,
                        title: lesson.title
                      });

                      totalLessons++;

                      // 3. 批量创建题目，使用创建的课程ID
                      const challenges = lesson.challenges || [];
                      if (challenges.length > 0) {
                        // 转换题目格式，适配 v2 数据库结构
                        const formattedChallenges = challenges.map((ch: any, cIdx: number) => ({
                          id: ch.id || `auto-ch-${timestamp}-${uIdx}-${lIdx}-${cIdx}`,
                          type: ch.type,
                          question: ch.question,
                          correct_answer: ch.correctAnswer || ch.correct_answer,
                          options: ch.options,
                          explanation: ch.explanation,
                          image_url: ch.imageUrl || ch.image_url
                        }));

                        await apiClientV2.createChallengesBatch(createdLesson.id, formattedChallenges);
                        totalChallenges += challenges.length;
                      }
                    }
                  }

                  // 刷新本地数据
                  const outlineData = await apiClientV2.fetchUnitsOutline();
                  if (outlineData) {
                    const unitsFromOutline: Unit[] = outlineData.map((u: any) => ({
                      ...u,
                      lessons: u.lessons.map((l: any) => ({
                        ...l,
                        completed: false,
                        locked: false,
                        stars: 0,
                        challenges: []
                      }))
                    }));
                    setUnits(unitsFromOutline);
                  }

                  setSyncStatus('saved');
                  setTimeout(() => setSyncStatus('idle'), 2000);
                  showToast(
                    `已保存 ${newUnits.length} 个章节、${totalLessons} 个小节、${totalChallenges} 道题目到数据库。`,
                    'success',
                    '✨ 结构化生成完成！'
                  );
                } catch (error: any) {
                  console.error('Failed to save generated structure:', error);
                  setSyncStatus('error');
                  showToast(
                    `${error.message}\n\n生成的内容未能保存到数据库，请在任务管理器中查看结果并手动处理。`,
                    'error',
                    '保存失败'
                  );
                }
              }
            } else if (task.type === 'generate_questions' && task.result) {
              // 标记为已处理
              markTaskProcessed(task.id);
              
              // 题目生成完成，提示用户在任务管理器中保存
              const questionsCount = Array.isArray(task.result) ? task.result.length : 0;
              if (questionsCount > 0) {
                showToast(
                  `共生成 ${questionsCount} 道题目。请在任务管理器中点击"查看结果"，然后选择要保存到的课程。`,
                  'success',
                  '✨ 题目生成完成！'
                );
              }
            }
          }}
          onDataRefresh={async () => {
            // 当题目保存后刷新课程数据
            try {
              const outlineData = await apiClientV2.fetchUnitsOutline();
              if (outlineData) {
                const unitsFromOutline: Unit[] = outlineData.map((u: any) => ({
                  ...u,
                  lessons: u.lessons.map((l: any) => ({
                    ...l,
                    completed: userProgress.completedLessonIds.includes(l.id),
                    locked: false,
                    stars: 0,
                    challenges: []
                  }))
                }));
                setUnits(unitsFromOutline);
              }
            } catch (error) {
              console.error('Failed to refresh data:', error);
            }
          }}
        />
      )}
      
      <main className="flex-1 relative h-[calc(100vh-80px)] md:h-screen overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="bg-white/90 backdrop-blur-md sticky top-0 z-20 px-6 py-4 flex justify-between items-center border-b border-gray-100">
            <div className="flex gap-6">
                <div className="flex items-center gap-2 text-yellow-500 font-extrabold text-lg">
                    <Zap fill="currentColor" size={20} /> <span>{userProgress.xp}</span>
                </div>
                <div className="flex items-center gap-2 text-rose-500 font-extrabold text-lg">
                    <Heart fill="currentColor" size={20} /> <span>{userProgress.hearts}</span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {syncStatus === 'saving' && <span className="text-xs font-bold text-gray-400 flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> 云端同步中...</span>}
                {syncStatus === 'saved' && <span className="text-xs font-bold text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 已保存</span>}
                {syncStatus === 'error' && <span className="text-xs font-bold text-red-500 flex items-center gap-1"><Cloud size={12}/> 同步失败</span>}
                
                <div className="flex items-center gap-2 text-orange-500 font-extrabold">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-sm">🔥</div>
                    <span>{userProgress.streak}</span>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto">
            {activeTab === 'learn' && (
                <div className="p-4 md:p-8">
                    <UnitPath units={units} onStartLesson={handleStartLesson} />
                </div>
            )}

            {activeTab === 'mybanks' && (
                <PersonalPanel 
                  knowledgeBase={knowledgeBase}
                  setKnowledgeBase={setKnowledgeBase}
                  onStartPractice={(bankId, sectionId, challenges) => {
                    setUserBankPractice({ bankId, sectionId, challenges });
                  }}
                />
            )}

            {activeTab === 'leaderboard' && (
                <Leaderboard currentUserId={session.user.id} />
            )}

            {activeTab === 'admin' && isAdmin && (
                <AdminPanel 
                    units={units} 
                    setUnits={handleSetUnits} 
                    knowledgeBase={knowledgeBase} 
                    setKnowledgeBase={(val) => {
                      // Allow updates for both admin and user
                      setKnowledgeBase(val);
                    }}
                    onKnowledgeBaseAction={handleUpdateKnowledgeBase}
                    userId={session.user.id}
                    onTaskCreated={(taskId, type) => {
                        console.log(`Task created: ${taskId} (${type})`);
                        // 任务创建后可以在这里触发刷新任务管理器等操作
                    }}
                />
            )}
            
            {activeTab === 'profile' && (
                <div className="p-8 max-w-2xl mx-auto">
                    <div className="bg-white border-2 border-gray-200 rounded-2xl p-6 flex gap-6 items-center mb-8 shadow-sm">
                        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-3xl text-white font-bold border-4 border-white shadow-lg">
                        {session.user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="text-xl font-bold truncate">{session.user.email}</h3>
                            <p className="text-gray-500 text-xs">加入时间: {new Date(session.user.created_at).toLocaleDateString()}</p>
                            <p className="text-gray-400 text-xs mt-1">ID: {session.user.id.slice(0, 8)}...</p>
                            {isAdmin && <span className="inline-block mt-2 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-bold uppercase tracking-wider">Administrator</span>}
                        </div>
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-800 mb-4">统计数据</h3>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="border-2 border-gray-200 rounded-xl p-4">
                            <div className="text-yellow-500 mb-2"><Zap /></div>
                            <div className="text-2xl font-bold">{userProgress.xp}</div>
                            <div className="text-gray-400 text-sm font-bold uppercase">总经验值</div>
                        </div>
                        <div className="border-2 border-gray-200 rounded-xl p-4">
                            <div className="text-orange-500 mb-2"><span className="text-2xl">🔥</span></div>
                            <div className="text-2xl font-bold">{userProgress.streak}</div>
                            <div className="text-gray-400 text-sm font-bold uppercase">连胜天数</div>
                        </div>
                        <div className="border-2 border-gray-200 rounded-xl p-4">
                            <div className="text-blue-500 mb-2"><BookOpen /></div>
                            <div className="text-2xl font-bold">{userProgress.completedLessonIds.length}</div>
                            <div className="text-gray-400 text-sm font-bold uppercase">完成课程</div>
                        </div>
                        <div className="border-2 border-gray-200 rounded-xl p-4">
                            <div className="text-rose-500 mb-2"><Heart fill="currentColor" /></div>
                            <div className="text-2xl font-bold">{userProgress.hearts}</div>
                            <div className="text-gray-400 text-sm font-bold uppercase">获得红心</div>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <button onClick={handleLogout} className="text-gray-600 font-bold border-2 border-gray-200 p-4 rounded-xl w-full hover:bg-gray-100 flex items-center justify-center gap-2 transition-colors">
                            <LogOut size={20} /> 退出登录
                        </button>

                        <button onClick={() => { if(window.confirm && confirm('确定要重置当前进度吗？')) { handleSetUserProgress({ hearts: 5, xp: 0, streak: 1, completedLessonIds: [] }); } }} className="text-red-500 font-bold border-2 border-red-100 p-4 rounded-xl w-full hover:bg-red-50 flex items-center justify-center gap-2 transition-colors">
                            <Trash2 size={20} /> 重置我的进度
                        </button>
                    </div>
                </div>
            )}

            <footer className="py-6 text-center text-sm text-gray-400 border-t border-gray-100 mt-auto">
                <div className="flex flex-col items-center gap-2">
                    <p>© 2025 LabZoon实验动物学</p>
                    <a 
                        href="https://beian.miit.gov.cn/" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="hover:text-gray-600 transition-colors"
                    >
                        湘ICP备2025149156号-1
                    </a>
                </div>
            </footer>
        </div>
      </main>

      {/* Toast 通知 */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div 
            className={`
              flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-sm max-w-md
              ${toast.type === 'success' ? 'bg-green-50/95 border-green-200 text-green-800' : ''}
              ${toast.type === 'error' ? 'bg-red-50/95 border-red-200 text-red-800' : ''}
              ${toast.type === 'info' ? 'bg-blue-50/95 border-blue-200 text-blue-800' : ''}
            `}
          >
            <div className="flex-shrink-0 mt-0.5">
              {toast.type === 'success' && <CheckCircle2 size={20} className="text-green-500" />}
              {toast.type === 'error' && <AlertCircle size={20} className="text-red-500" />}
              {toast.type === 'info' && <AlertCircle size={20} className="text-blue-500" />}
            </div>
            <div className="flex-1 min-w-0">
              {toast.title && (
                <p className="font-semibold text-sm mb-1">{toast.title}</p>
              )}
              <p className="text-sm whitespace-pre-line">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-black/5 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
