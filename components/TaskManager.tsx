import React, { useState, useEffect, useCallback } from 'react';
import { 
  Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, 
  ChevronDown, RefreshCw, X,
  FileText, Image, Layers, Sparkles, Timer, Save, ChevronLeft, ChevronRight
} from 'lucide-react';
import { userBankApi, UserQuestionBank, UserBankSection } from '../apiClient';

// Task types matching backend
type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
type TaskType = 'generate_questions' | 'generate_structure' | 'generate_image' | 'batch_generate';

interface Task {
  id: string;
  user_id: string;
  type: TaskType;
  status: TaskStatus;
  title: string;
  progress: number;
  result?: any;
  error?: string;
  input_summary?: string;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  metadata?: Record<string, any>;
}

interface TaskManagerProps {
  userId: string;
  onClose?: () => void;
  isFloating?: boolean;
  onTaskComplete?: (task: Task) => void;
  onDataRefresh?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper: Format duration
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
};

// Helper: Format time ago
const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
};

// Task type icons and labels
const taskTypeConfig: Record<TaskType, { icon: React.ReactNode; label: string; color: string }> = {
  generate_questions: { icon: <FileText size={14} />, label: '题目生成', color: 'blue' },
  generate_structure: { icon: <Layers size={14} />, label: '智能结构化生成', color: 'purple' },
  generate_image: { icon: <Image size={14} />, label: '图片生成', color: 'green' },
  batch_generate: { icon: <Sparkles size={14} />, label: '批量生成', color: 'orange' }
};

// Status config
const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; color: string }> = {
  pending: { icon: <Clock size={14} />, label: '等待中', color: 'gray' },
  running: { icon: <Loader2 size={14} className="animate-spin" />, label: '进行中', color: 'blue' },
  completed: { icon: <CheckCircle2 size={14} />, label: '已完成', color: 'green' },
  failed: { icon: <XCircle size={14} />, label: '失败', color: 'red' },
  cancelled: { icon: <AlertTriangle size={14} />, label: '已取消', color: 'yellow' }
};

// Main TaskManager Component
export default function TaskManager({ userId, onClose, isFloating = false, onTaskComplete, onDataRefresh }: TaskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false); // 控制面板展开/折叠
  
  // 已处理任务 ID 跟踪，避免重复触发回调
  const [processedTaskIds] = useState<Set<string>>(() => new Set());
  
  // 题目保存相关状态
  const [savingTask, setSavingTask] = useState<Task | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 保存题目到用户个人题库
  const handleSaveQuestions = async () => {
    if (!savingTask || !savingTask.result) return;
    
    setIsSaving(true);
    try {
      // 根据返回格式处理题目
      let challenges: any[] = [];
      
      if (savingTask.type === 'generate_questions') {
        // 新格式: { questions: [...], rescuedCount, invalidCount }
        if (savingTask.result.questions) {
          challenges = savingTask.result.questions;
        } else {
          // 兼容旧格式: 直接是题目数组
          challenges = Array.isArray(savingTask.result) ? savingTask.result : [];
        }
      } else {
        // 其他类型，直接使用结果
        challenges = Array.isArray(savingTask.result) ? savingTask.result : [];
      }
      
      if (challenges.length === 0) {
        alert('没有可保存的题目');
        return;
      }
      
      // 格式化题目
      const formattedChallenges = challenges.map((ch: any, idx: number) => ({
        id: ch.id || `challenge-${Date.now()}-${idx}`,
        type: ch.type,
        question: ch.question,
        correct_answer: ch.correctAnswer || ch.correct_answer,
        options: ch.options,
        explanation: ch.explanation,
        image_url: ch.imageUrl || ch.image_url
      }));

      // 只保存到用户私人题库
      try {
        // 获取或创建默认题库
        const banks = await userBankApi.fetchBanks();
        let targetBank: UserQuestionBank | undefined = banks.find(b => b.title === 'AI生成');
        
        if (!targetBank) {
          // 如果没有找到AI生成题库，创建一个
          targetBank = await userBankApi.createBank({
            title: 'AI生成',
            description: '由 AI 生成的题目',
            color: 'purple',
            icon: '🧠'
          });
        }
        
        // 获取或创建默认章节
        // 先获取完整的题库信息，包括章节
        const banksWithSections = await userBankApi.fetchBanks();
        const updatedTargetBank = banksWithSections.find(b => b.id === targetBank!.id);
        const existingSections = updatedTargetBank?.sections || [];
        let targetSection: UserBankSection | undefined = existingSections.find(s => s.title === '自动生成');
        
        if (!targetSection) {
          // 如果没有找到"自动生成"章节，创建一个
          targetSection = await userBankApi.createSection(targetBank.id, '自动生成');
        }
        
        // 保存题目到用户题库
        if (targetSection?.id) {
          await userBankApi.createChallengesBatch(targetSection.id, formattedChallenges);
          
          const savedCount = formattedChallenges.length;
          const invalidCount = savingTask.result.invalidCount || 0;
          
          alert(`✅ 成功保存 ${savedCount} 道题目到个人题库！` + 
                (invalidCount > 0 ? `\n⚠️ ${invalidCount} 道题目因格式错误已跳过` : ''));
        } else {
          throw new Error('无法创建章节');
        }
        
        // 触发用户题库刷新事件
        window.dispatchEvent(new CustomEvent('userBankDataChanged'));
      } catch (userBankError) {
        console.error('保存到用户题库失败:', userBankError);
        alert(`保存失败: ${userBankError instanceof Error ? userBankError.message : '未知错误'}`);
      }
      
      setSavingTask(null);
      
      if (onDataRefresh) {
        onDataRefresh();
      }
    } catch (error: any) {
      console.error('Failed to save questions:', error);
      alert(`保存失败: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/tasks?user_id=${userId}&limit=50`);
      if (response.ok) {
        const { data } = await response.json();
        setTasks(data || []);
        
        if (onTaskComplete) {
          const completedTasks = (data || []).filter((t: Task) => 
            t.status === 'completed' && 
            t.completed_at && 
            Date.now() - t.completed_at < 5000 &&
            !processedTaskIds.has(t.id) // 只处理未处理过的任务
          );
          completedTasks.forEach((t: Task) => {
            processedTaskIds.add(t.id); // 标记为已处理
            onTaskComplete(t);
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, onTaskComplete, processedTaskIds]);

  // Initial fetch and polling
  useEffect(() => {
    fetchTasks();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        const hasRunning = tasks.some(t => t.status === 'pending' || t.status === 'running');
        if (hasRunning) {
          fetchTasks();
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [fetchTasks, autoRefresh, tasks]);

  // Cancel task
  const handleCancel = async (taskId: string) => {
    try {
      await fetch(`${API_URL}/tasks/${taskId}`, { method: 'DELETE' });
      fetchTasks();
    } catch (error) {
      console.error('Failed to cancel task:', error);
    }
  };

  // View result
  const handleViewResult = (task: Task) => {
    if (task.type === 'generate_questions' && task.result) {
      setSavingTask(task);
    } else if (task.type === 'generate_structure' && task.result) {
      // For structure generation, show details about rescued/failed items
      if (task.result.units) {
        const rescuedCount = task.result.rescuedCount || 0;
        const invalidCount = task.result.invalidCount || 0;
        alert(`✅ 成功生成 ${rescuedCount} 个单元` + 
              (invalidCount > 0 ? `，${invalidCount} 个单元格式错误已跳过` : ''));
      } else {
        alert(`生成了 ${task.result.units?.length || 0} 个单元`);
      }
    } else {
      const count = Array.isArray(task.result) ? task.result.length : 1;
      alert(`生成了 ${count} 个项目`);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (filter === 'all') return true;
    if (filter === 'running') return task.status === 'pending' || task.status === 'running';
    if (filter === 'completed') return task.status === 'completed';
    if (filter === 'failed') return task.status === 'failed' || task.status === 'cancelled';
    return true;
  });

  // Count by status
  const runningCount = tasks.filter(t => t.status === 'pending' || t.status === 'running').length;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const failedCount = tasks.filter(t => t.status === 'failed' || t.status === 'cancelled').length;

  // 折叠状态的紧凑视图
  if (!isExpanded) {
    return (
      <div className="hidden md:flex flex-col bg-white border-r border-gray-200 w-12 transition-all duration-300">
        {/* 展开按钮 */}
        <button
          onClick={() => setIsExpanded(true)}
          className="p-3 hover:bg-gray-100 transition-colors flex flex-col items-center gap-1 border-b border-gray-100"
          title="展开任务管理器"
        >
          <Sparkles size={18} className="text-purple-500" />
          <ChevronRight size={14} className="text-gray-400" />
        </button>
        
        {/* 运行中任务指示器 */}
        {runningCount > 0 && (
          <div className="p-2 flex flex-col items-center gap-1 border-b border-gray-100">
            <div className="relative">
              <Loader2 size={16} className="text-blue-500 animate-spin" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {runningCount}
              </span>
            </div>
          </div>
        )}
        
        {/* 已完成任务指示器 */}
        {completedCount > 0 && (
          <div className="p-2 flex flex-col items-center" title={`${completedCount} 个已完成`}>
            <CheckCircle2 size={16} className="text-green-500" />
            <span className="text-[10px] text-gray-500">{completedCount}</span>
          </div>
        )}
        
        {/* 失败任务指示器 */}
        {failedCount > 0 && (
          <div className="p-2 flex flex-col items-center" title={`${failedCount} 个失败`}>
            <XCircle size={16} className="text-red-500" />
            <span className="text-[10px] text-gray-500">{failedCount}</span>
          </div>
        )}
      </div>
    );
  }

  // 展开状态的完整视图
  return (
    <div className="hidden md:flex flex-col bg-white border-r border-gray-200 w-80 transition-all duration-300">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
        <div className="flex items-center gap-2">
          <Sparkles className="text-purple-500" size={16} />
          <div>
            <h3 className="font-bold text-sm text-gray-800">任务管理器</h3>
            <p className="text-[10px] text-gray-500">
              {runningCount > 0 ? `${runningCount} 个进行中` : '暂无进行中'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchTasks}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            title="折叠"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100 text-[11px]">
        <button
          onClick={() => setFilter('all')}
          className={`px-2 py-1 font-medium rounded-md transition-colors ${
            filter === 'all' ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          全部 ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('running')}
          className={`px-2 py-1 font-medium rounded-md transition-colors flex items-center gap-1 ${
            filter === 'running' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {runningCount > 0 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
          进行中 ({runningCount})
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-2 py-1 font-medium rounded-md transition-colors ${
            filter === 'completed' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          已完成 ({completedCount})
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-2 py-1 font-medium rounded-md transition-colors ${
            filter === 'failed' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          失败 ({failedCount})
        </button>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="animate-spin text-gray-400" size={20} />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Clock size={24} className="mb-2" />
            <p className="text-xs">暂无任务记录</p>
          </div>
        ) : (
          filteredTasks.map(task => {
            const typeConfig = taskTypeConfig[task.type];
            const status = statusConfig[task.status];
            const isTaskExpanded = expandedTaskId === task.id;
            const duration = task.started_at 
              ? (task.completed_at || Date.now()) - task.started_at 
              : 0;

            return (
              <div 
                key={task.id}
                className={`border rounded-lg overflow-hidden transition-all ${
                  task.status === 'running' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200 bg-white'
                }`}
              >
                {/* Compact Row */}
                <div 
                  className="p-2 flex items-center gap-2 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedTaskId(isTaskExpanded ? null : task.id)}
                >
                  {/* Type Icon */}
                  <div className={`p-1.5 rounded bg-${typeConfig.color}-100 text-${typeConfig.color}-600`}>
                    {typeConfig.icon}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-gray-800 truncate">{task.title}</div>
                    <div className="text-[10px] text-gray-400 truncate">
                      {task.input_summary?.slice(0, 30) || typeConfig.label}
                    </div>
                  </div>

                  {/* Progress / Status */}
                  {task.status === 'running' ? (
                    <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  ) : (
                    <div className={`text-${status.color}-600`}>
                      {status.icon}
                    </div>
                  )}

                  <ChevronDown size={12} className={`text-gray-400 transition-transform ${isTaskExpanded ? 'rotate-180' : ''}`} />
                </div>

                {/* Expanded Details */}
                {isTaskExpanded && (
                  <div className="px-2 pb-2 pt-1 border-t border-gray-100 bg-gray-50/50 text-[11px]">
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-gray-600 mb-2">
                      <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>{formatTimeAgo(task.created_at)}</span>
                      </div>
                      {task.started_at && (
                        <div className="flex items-center gap-1">
                          <Timer size={10} />
                          <span>{formatDuration(duration)}</span>
                        </div>
                      )}
                    </div>

                    {/* Error Message */}
                    {task.error && (
                      <div className="p-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 mb-2">
                        {task.error.slice(0, 100)}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5">
                      {(task.status === 'pending' || task.status === 'running') && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancel(task.id); }}
                          className="px-2 py-1 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded transition-colors flex items-center gap-1"
                        >
                          <XCircle size={10} /> 取消
                        </button>
                      )}
                      {task.status === 'completed' && task.result && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleViewResult(task); }}
                          className="px-2 py-1 text-[10px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors flex items-center gap-1"
                        >
                          <FileText size={10} /> 查看结果
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-100 bg-gray-50 flex items-center justify-between text-[10px] text-gray-500">
        <label className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded w-3 h-3"
          />
          自动刷新
        </label>
        <span>最近 50 条记录</span>
      </div>

      {/* 保存题目对话框 */}
      {savingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Save className="text-blue-500" size={18} />
                  保存题目到个人题库
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  共 {Array.isArray(savingTask.result) ? savingTask.result.length : 0} 道题目待保存
                  {savingTask.rescuedCount !== undefined && (
                    <span className="text-green-600">（成功解析 {savingTask.rescuedCount} 道题目）</span>
                  )}
                  {savingTask.invalidCount && savingTask.invalidCount > 0 && (
                    <span className="text-orange-600">（{savingTask.invalidCount} 道题目格式错误已跳过）</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setSavingTask(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  题目将保存到您的个人题库中，在「题库管理」标签页可以查看和管理。
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  题目预览：
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {(Array.isArray(savingTask.result) ? savingTask.result : []).slice(0, 5).map((q: any, idx: number) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          q.type === 'MULTIPLE_CHOICE' ? 'bg-purple-100 text-purple-600' : 
                          q.type === 'TRUE_FALSE' ? 'bg-orange-100 text-orange-600' : 
                          q.type === 'SINGLE_CHOICE' ? 'bg-blue-100 text-blue-600' :
                          q.type === 'FILL_BLANK' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                        }`}>{q.type}</span>
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                    </div>
                  ))}
                  {Array.isArray(savingTask.result) && savingTask.result.length > 5 && (
                    <p className="text-xs text-gray-400 text-center py-2">
                      还有 {savingTask.result.length - 5} 道题目...
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setSavingTask(null)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveQuestions}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    保存到个人题库
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Floating Task Button (shows task count badge)
export function TaskManagerButton({ userId, onClick }: { userId: string; onClick: () => void }) {
  const [runningCount, setRunningCount] = useState(0);

  useEffect(() => {
    const checkRunning = async () => {
      try {
        const response = await fetch(`${API_URL}/tasks/running/count?user_id=${userId}`);
        if (response.ok) {
          const { count } = await response.json();
          setRunningCount(count);
        }
      } catch (error) {
        // Ignore
      }
    };

    checkRunning();
    const interval = setInterval(checkRunning, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 p-3 bg-white rounded-full shadow-lg border border-gray-200 hover:shadow-xl transition-all z-40 group"
      title="任务管理器"
    >
      <Sparkles className="text-purple-500 group-hover:scale-110 transition-transform" size={20} />
      {runningCount > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
          {runningCount}
        </span>
      )}
    </button>
  );
}
