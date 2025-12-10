
import React, { useState, useCallback } from 'react';
import { Zap, Briefcase, Library, Sparkles, Settings as SettingsIcon, Users, Database, Table2 } from 'lucide-react';
import { Unit, KnowledgeItem } from '../types';
import AdminGenerator from './AdminGenerator';
import AdminQuestionBank from './AdminQuestionBank';
import AdminLibrary from './AdminLibrary';
import AdminAISettings from './AdminAISettings';
import AdminUserManagement from './AdminUserManagement';
import DataBackupPanel from './DataBackupPanel';
import AdminTableView from './AdminTableView';

interface AdminPanelProps {
    units: Unit[];
    setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
    knowledgeBase: KnowledgeItem[];
    setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
    onKnowledgeBaseAction?: (action: 'add' | 'delete' | 'set', item?: KnowledgeItem) => void;
    userId?: string; // 新增：用户ID，用于后台任务
    onTaskCreated?: (taskId: string, type: 'questions' | 'structure') => void; // 新增：任务创建回调
}

export default function AdminPanel({ units, setUnits, knowledgeBase, setKnowledgeBase, onKnowledgeBaseAction, userId, onTaskCreated }: AdminPanelProps) {
  const [adminMode, setAdminMode] = useState<'generate' | 'library' | 'questions' | 'settings' | 'users' | 'backup' | 'table'>('generate');
  const [selectedLibraryItem, setSelectedLibraryItem] = useState<string | undefined>(undefined);

  const handleUseLibraryItem = (item: KnowledgeItem) => {
    setSelectedLibraryItem(item.id);
    setAdminMode('generate');
  };

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
            <Sparkles className="text-yellow-500" /> 内容管理中台
        </h2>
        
        {/* Admin Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-xl overflow-x-auto w-full md:w-auto scrollbar-hide">
            <button 
                onClick={() => setAdminMode('generate')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'generate' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
            >
                <Zap size={16} /> 题目生成
            </button>
            <button 
                onClick={() => setAdminMode('questions')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'questions' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}
            >
                <Briefcase size={16} /> 题库管理
            </button>
            <button 
                onClick={() => setAdminMode('table')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-gray-500'}`}
            >
                <Table2 size={16} /> 表格管理
            </button>
            <button 
                onClick={() => setAdminMode('library')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'library' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
            >
                <Library size={16} /> 知识库 ({knowledgeBase.length})
            </button>
            <button 
                onClick={() => setAdminMode('settings')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'settings' ? 'bg-white shadow text-gray-800' : 'text-gray-500'}`}
            >
                <SettingsIcon size={16} /> AI 设置
            </button>
             <button 
                onClick={() => setAdminMode('users')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'users' ? 'bg-white shadow text-pink-600' : 'text-gray-500'}`}
            >
                <Users size={16} /> 权限管理
            </button>
            <button 
                onClick={() => setAdminMode('backup')}
                className={`px-4 py-2 rounded-lg font-bold text-sm flex gap-2 items-center whitespace-nowrap ${adminMode === 'backup' ? 'bg-white shadow text-purple-600' : 'text-gray-500'}`}
            >
                <Database size={16} /> 数据备份
            </button>
        </div>
      </div>

      {/* --- Modular Components --- */}

      {adminMode === 'generate' && (
          <AdminGenerator 
            units={units}
            setUnits={setUnits}
            knowledgeBase={knowledgeBase}
            setKnowledgeBase={setKnowledgeBase} // Keeping prop for type safety, but will prefer action handler
            onKnowledgeBaseAction={onKnowledgeBaseAction}
            initialLibraryId={selectedLibraryItem}
            onResetLibrarySelection={() => setSelectedLibraryItem(undefined)}
            userId={userId}
            onTaskCreated={onTaskCreated}
          />
      )}

      {adminMode === 'questions' && (
          <AdminQuestionBank 
            units={units}
            setUnits={setUnits}
            userId={userId}
          />
      )}

      {adminMode === 'table' && (
          <AdminTableView 
            units={units}
            onRefresh={() => {
              // Trigger refresh of units data
              window.location.reload();
            }}
          />
      )}

      {adminMode === 'library' && (
          <AdminLibrary 
            knowledgeBase={knowledgeBase}
            setKnowledgeBase={setKnowledgeBase}
            onUseItem={handleUseLibraryItem}
            onKnowledgeBaseAction={onKnowledgeBaseAction}
          />
      )}

      {adminMode === 'settings' && (
          <AdminAISettings userId={userId} />
      )}
      
      {adminMode === 'users' && (
          <AdminUserManagement />
      )}

      {adminMode === 'backup' && (
          <DataBackupPanel />
      )}
      
    </div>
  );
}
