import React, { useState } from 'react';
import { Zap, Briefcase, Library, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import AdminLibrary from './AdminLibrary';
import PersonalAISettings from './PersonalAISettingsV2';
import { apiClient } from '../apiClient';
import UserQuestionBanks from './UserQuestionBanks';
import PersonalGenerator from './PersonalGenerator';
import { KnowledgeItem, Challenge } from '../types';
import TaskManager from './TaskManager';
import { supabase } from '../supabase';
import { saveTaskResultToUserBank } from '../hooks/useAIGenerator';
import { userBankApi, UserQuestionBank, UserBankSection } from '../apiClient';

interface PersonalPanelProps {
  knowledgeBase: KnowledgeItem[];
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
  onStartPractice?: (bankId: string, sectionId: string, challenges: Challenge[]) => void;
}

export default function PersonalPanel({ knowledgeBase, setKnowledgeBase, onStartPractice }: PersonalPanelProps) {
  const [mode, setMode] = useState<'generate' | 'questions' | 'library' | 'settings'>('generate');
  const [userId, setUserId] = useState<string>('');
  React.useEffect(() => {
    apiClient.fetchUserKnowledgeBase().then(setKnowledgeBase).catch(() => {});
  }, []);
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    }).catch(() => {});
  }, []);

  // 自动保存到个人题库的函数
  const autoSaveToUserBank = async (taskResult: any, taskType: string) => {
    if (!taskResult || (taskType !== 'generate_questions' && taskType !== 'generate_structure')) return;
    try {
      const res = await saveTaskResultToUserBank(taskResult);
      if (res && res.saved) {
        console.log(`✅ 自动保存成功: ${res.saved} 道题目已保存到个人题库` + (res.invalidCount ? `，${res.invalidCount} 道题目因格式错误已跳过` : ''));
        window.dispatchEvent(new CustomEvent('userBankDataChanged'));
      }
    } catch (error: any) {
      console.error('自动保存到个人题库失败:', error);
    }
  };

  return (
    <div className="flex w-full">
      {userId && (
        <TaskManager 
          userId={userId}
          onTaskComplete={async (task) => {
            // 自动保存到个人题库
            if (task.result) {
              await autoSaveToUserBank(task.result, task.type);
            }
            
            // 对于结构化生成任务，显示成功/失败信息
            if (task.type === 'generate_structure' && task.result) {
              const rescuedCount = task.result.rescuedCount || 0;
              const invalidCount = task.result.invalidCount || 0;
              
              if (rescuedCount > 0) {
                console.log(`成功生成 ${rescuedCount} 个单元` + 
                  (invalidCount > 0 ? `，${invalidCount} 个单元格式错误已跳过` : ''));
              }
            }
            
            // 触发界面刷新
            window.dispatchEvent(new CustomEvent('userBankDataChanged'));
          }}
          onDataRefresh={async () => {
            // 当题目保存完成时，需要刷新 UserQuestionBanks 组件的数据
            window.dispatchEvent(new CustomEvent('userBankDataChanged'));
          }}
        />
      )}
      <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
          <Sparkles className="text-yellow-500" /> 个人内容工作台
        </h2>

        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto w-full md:w-auto scrollbar-hide">
          <button
            onClick={() => setMode('generate')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${mode === 'generate' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
          >
            <Zap size={16} /> 题目生成
          </button>
          <button
            onClick={() => {
              setMode('questions');
              // 触发题库数据刷新
              window.dispatchEvent(new CustomEvent('userBankDataChanged'));
            }}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${mode === 'questions' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
          >
            <Briefcase size={16} /> 题库管理
          </button>
          <button
            onClick={() => setMode('library')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${mode === 'library' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
          >
          <Library size={16} /> 我的知识库 ({knowledgeBase.length})
          </button>
          <button
            onClick={() => setMode('settings')}
            className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${mode === 'settings' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
          >
            <SettingsIcon size={16} /> AI 设置
          </button>
        </div>
      </div>

      {mode === 'generate' && (
        <PersonalGenerator knowledgeBase={knowledgeBase} setKnowledgeBase={setKnowledgeBase} />
      )}

      {mode === 'questions' && (
        <UserQuestionBanks onStartPractice={onStartPractice} />
      )}

      {mode === 'library' && (
        <AdminLibrary
          knowledgeBase={knowledgeBase}
          setKnowledgeBase={setKnowledgeBase}
          onUseItem={() => {}}
          onKnowledgeBaseAction={async (action, item) => {
            if (!item) return;
            if (action === 'add') {
              // Ensure we update state immediately for better UX, then sync with API
              setKnowledgeBase(prev => [item, ...prev]);
              try {
                await apiClient.addUserKnowledgeItem(item);
              } catch (e) {
                console.error("Failed to add item:", e);
                // Revert on failure
                setKnowledgeBase(prev => prev.filter(k => k.id !== item.id));
                alert("Failed to add item");
              }
            } else if (action === 'delete') {
              setKnowledgeBase(prev => prev.filter(k => k.id !== item.id));
              try {
                await apiClient.deleteUserKnowledgeItem(item.id);
              } catch (e) {
                 console.error("Failed to delete item:", e);
                 // Revert
                 setKnowledgeBase(prev => [item, ...prev]);
                 alert("Failed to delete item");
              }
            }
          }}
        />
      )}

        {mode === 'settings' && (
          <PersonalAISettings />
        )}
      </div>
    </div>
  );
}

