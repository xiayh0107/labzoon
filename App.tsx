
import React, { useState, useEffect } from 'react';
import { Heart, Zap, BookOpen, Trash2, AlertCircle, Loader2, LogOut, Cloud, CheckCircle2, Database, Terminal, Copy } from 'lucide-react';
import { Unit, UserProgress, KnowledgeItem } from './types';
import { INITIAL_UNITS } from './constants';
import { supabase } from './supabase';
import { Session } from '@supabase/supabase-js';

// Imported modular components
import Sidebar from './components/Sidebar';
import UnitPath from './components/UnitPath';
import LessonSession from './components/LessonSession';
import AdminPanel from './components/AdminPanel';
import AuthScreen from './components/AuthScreen';
import Leaderboard from './components/Leaderboard';

const GLOBAL_UNITS_ID = 'global-units';

// --- SQL Script for User Convenience ---
const REQUIRED_SQL = `
-- 1. App Units Table (Stores the global curriculum)
create table if not exists app_units (
  id text primary key,
  data jsonb
);
alter table app_units enable row level security;
drop policy if exists "Public read app_units" on app_units;
create policy "Public read app_units" on app_units for select using (true);
drop policy if exists "Public insert app_units" on app_units;
create policy "Public insert app_units" on app_units for insert with check (true);
drop policy if exists "Public update app_units" on app_units;
create policy "Public update app_units" on app_units for update using (true);

-- 2. User Progress Table (Stores XP, Hearts, Completed Lessons)
create table if not exists user_progress (
  user_id uuid primary key references auth.users(id),
  data jsonb
);
alter table user_progress enable row level security;

-- IMPORTANT: Updated policy to allow Leaderboard (Authenticated users can read all progress)
drop policy if exists "Users can read own progress" on user_progress;
drop policy if exists "Read all progress" on user_progress;
create policy "Read all progress" on user_progress for select using (auth.role() = 'authenticated');
drop policy if exists "Users can insert own progress" on user_progress;
create policy "Users can insert own progress" on user_progress for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update own progress" on user_progress;
create policy "Users can update own progress" on user_progress for update using (auth.uid() = user_id);

-- 3. Knowledge Base Table (Stores uploaded content/images)
create table if not exists knowledge_base (
  id text primary key,
  title text,
  content text,
  type text,
  image_data text,
  created_at bigint
);
alter table knowledge_base enable row level security;
drop policy if exists "Public read kb" on knowledge_base;
create policy "Public read kb" on knowledge_base for select using (true);
drop policy if exists "Public insert kb" on knowledge_base;
create policy "Public insert kb" on knowledge_base for insert with check (true);
drop policy if exists "Public delete kb" on knowledge_base;
create policy "Public delete kb" on knowledge_base for delete using (true);

-- 4. App Admins Table (Stores emails of authorized admins)
create table if not exists app_admins (
  email text primary key,
  created_at bigint
);
alter table app_admins enable row level security;
drop policy if exists "Public read admins" on app_admins;
create policy "Public read admins" on app_admins for select using (true);
drop policy if exists "Admins can insert admins" on app_admins;
create policy "Admins can insert admins" on app_admins for insert with check (true); 
drop policy if exists "Admins can delete admins" on app_admins;
create policy "Admins can delete admins" on app_admins for delete using (true);

-- Seed Initial Admin (admin@labzoon.com)
insert into app_admins (email, created_at)
values ('admin@labzoon.com', 1716300000000)
on conflict (email) do nothing;
`;

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // App Data State
  const [activeTab, setActiveTab] = useState('learn');
  const [dataLoading, setDataLoading] = useState(false);
  const [units, setUnits] = useState<Unit[]>(INITIAL_UNITS);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeItem[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress>({ 
      hearts: 5, xp: 0, streak: 1, completedLessonIds: [], email: '' 
  });

  const [currentSession, setCurrentSession] = useState<{unitId: string, lessonId: string} | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [dbMissing, setDbMissing] = useState(false);

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
        // This ensures access even if DB tables are missing or empty
        if (session.user.email === 'admin@labzoon.com') {
            setIsAdmin(true);
            return; 
        }
        
        // 1. Check DB for admin email
        const { data, error } = await supabase.from('app_admins').select('email').eq('email', session.user.email).maybeSingle();
        
        if (data) {
            setIsAdmin(true);
        } else {
            setIsAdmin(false);
            // If user was on admin tab but lost rights, kick them out
            if (activeTab === 'admin') setActiveTab('learn');
        }
    };
    
    if (session) {
        checkAdmin();
    }
  }, [session, activeTab]);

  // --- 3. Data Fetching & Seeding ---
  useEffect(() => {
    if (!session) return;

    const fetchAllData = async () => {
        setDataLoading(true);
        setDbMissing(false);
        try {
            // A. Check for Tables Existence FIRST
            // We check app_units AND app_admins to ensure schema is complete
            const { error: unitsTableError } = await supabase.from('app_units').select('id').limit(1);
            const { error: adminsTableError } = await supabase.from('app_admins').select('email').limit(1);

            if ((unitsTableError && unitsTableError.code === '42P01') || (adminsTableError && adminsTableError.code === '42P01')) {
                console.error("Database tables missing.");
                setDbMissing(true);
                setDataLoading(false);
                return;
            }

            // B. Fetch Global Units
            const { data: unitsData, error: unitsError } = await supabase.from('app_units').select('data').eq('id', GLOBAL_UNITS_ID).single();
            
            if (unitsError) {
                if (unitsError.code === 'PGRST116') { // Row missing
                    // Auto-seed initial units
                    console.log("Seeding initial units...");
                    await supabase.from('app_units').insert({ id: GLOBAL_UNITS_ID, data: INITIAL_UNITS });
                    // Keep local INITIAL_UNITS
                }
            } else if (unitsData?.data) {
                setUnits(unitsData.data);
            }

            // C. Fetch User Specific Progress
            const { data: progressData, error: progressError } = await supabase.from('user_progress').select('data').eq('user_id', session.user.id).single();
            
            if (progressError) {
                 if (progressError.code === 'PGRST116') {
                    // First time user, seed progress with EMAIL (crucial for leaderboard)
                    const defaultProgress = { 
                        hearts: 5, xp: 0, streak: 1, completedLessonIds: [],
                        email: session.user.email 
                    };
                    const { error: insertError } = await supabase.from('user_progress').insert({ user_id: session.user.id, data: defaultProgress });
                    if (insertError) console.error("Failed to init user progress:", JSON.stringify(insertError, null, 2));
                    setUserProgress(defaultProgress);
                 } else {
                     console.error("Error fetching progress:", JSON.stringify(progressError, null, 2));
                 }
            } else if (progressData?.data) {
                // Ensure email is up to date in local state if missing
                setUserProgress({ ...progressData.data, email: session.user.email });
            }

            // D. Fetch Knowledge Base
            const { data: kbData, error: kbError } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false });
            
            if (kbError) {
                console.error("Error fetching knowledge base:", JSON.stringify(kbError, null, 2));
                // Don't block app if just KB fails
            } else if (kbData) {
                const formattedKb: KnowledgeItem[] = kbData.map((item: any) => ({
                    id: item.id,
                    title: item.title,
                    content: item.content,
                    type: item.type as 'text' | 'image',
                    imageData: item.image_data,
                    createdAt: parseInt(item.created_at) || Date.now()
                }));
                setKnowledgeBase(formattedKb);
            }

        } catch (error) {
            console.error("Critical Data Error:", error);
        } finally {
            setDataLoading(false);
        }
    };

    fetchAllData();
  }, [session]);

  // --- 4. Data Persistence ---

  const handleSetUnits = (action: React.SetStateAction<Unit[]>) => {
      setSyncStatus('saving');
      setUnits((prevUnits) => {
          const newUnits = action instanceof Function ? action(prevUnits) : action;
          if (!dbMissing) {
            supabase.from('app_units').upsert({ id: GLOBAL_UNITS_ID, data: newUnits })
                .then(({ error }) => {
                    if (error) {
                        console.error('Failed to save units to DB:', JSON.stringify(error, null, 2));
                        setSyncStatus('error');
                    } else {
                        setSyncStatus('saved');
                        setTimeout(() => setSyncStatus('idle'), 2000);
                    }
                });
          }
          return newUnits;
      });
  };

  const handleSetUserProgress = (newProgress: UserProgress) => {
      // Ensure we always save identity info for leaderboard
      const progressToSave = {
          ...newProgress,
          email: session?.user?.email, // Keep email fresh
          lastActive: Date.now()
      };

      setUserProgress(progressToSave);
      
      if (session?.user?.id && !dbMissing) {
          supabase.from('user_progress').upsert({ user_id: session.user.id, data: progressToSave })
            .then(({ error }) => {
                if (error) console.error("Failed to save progress:", JSON.stringify(error, null, 2));
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
              const { error } = await supabase.from('knowledge_base').insert({
                  id: item.id,
                  title: item.title,
                  content: item.content,
                  type: item.type,
                  image_data: item.imageData,
                  created_at: item.createdAt
              });
              if(error) throw error;
          }
          else if (action === 'delete' && item) {
              setKnowledgeBase(prev => prev.filter(k => k.id !== item.id));
              const { error } = await supabase.from('knowledge_base').delete().eq('id', item.id);
              if(error) throw error;
          }
          setSyncStatus('saved');
          setTimeout(() => setSyncStatus('idle'), 2000);
      } catch (err: any) {
          console.error("Knowledge base DB error:", JSON.stringify(err, null, 2));
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
          <div className="min-h-screen flex items-center justify-center bg-white text-green-600 flex-col gap-4">
              <Loader2 size={48} className="animate-spin" />
              <p className="font-bold text-lg">正在同步实验数据...</p>
          </div>
      );
  }

  if (currentSession) {
      const unit = units.find(u => u.id === currentSession.unitId);
      const lesson = unit?.lessons.find(l => l.id === currentSession.lessonId);
      if (lesson) {
          return (
            <>
                <LessonSession lesson={lesson} onComplete={handleLessonComplete} onExit={handleExitLesson} />
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

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white md:bg-gray-50 text-gray-800 font-sans">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isAdmin={isAdmin} />
      
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

            {activeTab === 'leaderboard' && (
                <Leaderboard currentUserId={session.user.id} />
            )}

            {activeTab === 'admin' && isAdmin && (
                <AdminPanel 
                    units={units} 
                    setUnits={handleSetUnits} 
                    knowledgeBase={knowledgeBase} 
                    setKnowledgeBase={(val) => console.warn("Direct setKnowledgeBase disabled")}
                    onKnowledgeBaseAction={handleUpdateKnowledgeBase}
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
        </div>
      </main>
    </div>
  );
};

export default App;
