import React, { useState, useEffect, useCallback } from 'react';
import { 
  Trash2, Edit3, Save, X, CheckSquare, Square, Search, RefreshCw, AlertTriangle,
  BookOpen, FileText, HelpCircle, GripVertical, FolderInput
} from 'lucide-react';
import { Unit } from '../types';
import { apiClientV2 } from '../apiClient';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AdminTableViewProps {
  units: Unit[];
  onRefresh: () => void;
}

type TabType = 'units' | 'lessons' | 'challenges';

interface UnitRow {
  id: string;
  title: string;
  description: string;
  color: string;
  order_index: number;
  lessonCount: number;
}

interface LessonRow {
  id: string;
  unit_id: string;
  unitTitle: string;
  title: string;
  order_index: number;
  challengeCount: number;
}

interface ChallengeRow {
  id: string;
  lesson_id: string;
  lessonTitle: string;
  unitTitle: string;
  type: string;
  question: string;
  correct_answer: string;
  order_index: number;
}

// Sortable Row Component
interface SortableRowProps {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
}

const SortableRow: React.FC<SortableRowProps> = ({ id, children, disabled }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto' as any,
  };

  return (
    <tr ref={setNodeRef} style={style} className={`hover:bg-gray-50 ${isDragging ? 'bg-blue-50 shadow-lg' : ''}`}>
      <td className="px-2 py-3 w-10">
        <button
          {...attributes}
          {...listeners}
          className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
          title="拖拽排序"
        >
          <GripVertical size={18} />
        </button>
      </td>
      {children}
    </tr>
  );
};

export default function AdminTableView({ units, onRefresh }: AdminTableViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('units');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  
  // Data states
  const [unitRows, setUnitRows] = useState<UnitRow[]>([]);
  const [lessonRows, setLessonRows] = useState<LessonRow[]>([]);
  const [challengeRows, setChallengeRows] = useState<ChallengeRow[]>([]);
  
  // Modal states
  const [deleteModal, setDeleteModal] = useState<{ show: boolean; ids: string[]; type: TabType } | null>(null);
  const [moveModal, setMoveModal] = useState<{ show: boolean; ids: string[]; type: 'lessons' | 'challenges' } | null>(null);
  const [targetUnitId, setTargetUnitId] = useState<string>('');
  const [targetLessonId, setTargetLessonId] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setSelectedIds(new Set());
    
    try {
      if (activeTab === 'units') {
        const data = await apiClientV2.fetchUnitsOutline();
        const rows: UnitRow[] = data.map((u: any) => ({
          id: u.id,
          title: u.title,
          description: u.description || '',
          color: u.color || 'blue',
          order_index: u.order_index || 0,
          lessonCount: u.lessons?.length || 0
        }));
        setUnitRows(rows.sort((a, b) => a.order_index - b.order_index));
      } else if (activeTab === 'lessons') {
        const data = await apiClientV2.fetchUnitsOutline();
        const rows: LessonRow[] = [];
        data.forEach((u: any) => {
          (u.lessons || []).forEach((l: any) => {
            rows.push({
              id: l.id,
              unit_id: u.id,
              unitTitle: u.title,
              title: l.title,
              order_index: l.order_index || 0,
              challengeCount: l.challengeCount || 0
            });
          });
        });
        setLessonRows(rows.sort((a, b) => {
          if (a.unit_id !== b.unit_id) return a.unitTitle.localeCompare(b.unitTitle);
          return a.order_index - b.order_index;
        }));
      } else if (activeTab === 'challenges') {
        const data = await apiClientV2.fetchUnitsOutline();
        const rows: ChallengeRow[] = [];
        
        for (const u of data) {
          for (const l of (u.lessons || [])) {
            try {
              const challenges = await apiClientV2.fetchChallenges(l.id);
              challenges.forEach((c: any) => {
                // 标准化类型字段
                let normalizedType = (c.type || '').toUpperCase();
                let normalizedAnswer = c.correct_answer || '';
                
                // 智能判断真正的题型
                if (normalizedType === 'MULTIPLE_CHOICE') {
                    const hasComma = normalizedAnswer.includes(',');
                    const isConsecutiveLetters = /^[A-Da-d]{2,}$/.test(normalizedAnswer.trim());
                    
                    if (hasComma || isConsecutiveLetters) {
                        // 确实是多选题
                        if (isConsecutiveLetters && !hasComma) {
                            normalizedAnswer = normalizedAnswer.toUpperCase().split('').join(',');
                        }
                    } else {
                        // 只有一个答案，实际是单选题
                        normalizedType = 'SINGLE_CHOICE';
                    }
                }
                
                rows.push({
                  id: c.id,
                  lesson_id: l.id,
                  lessonTitle: l.title,
                  unitTitle: u.title,
                  type: normalizedType,
                  question: c.question,
                  correct_answer: normalizedAnswer,
                  order_index: c.order_index || 0
                });
              });
            } catch (e) {
              // Skip lessons without challenges
            }
          }
        }
        setChallengeRows(rows.sort((a, b) => {
          if (a.lesson_id !== b.lesson_id) return a.lessonTitle.localeCompare(b.lessonTitle);
          return a.order_index - b.order_index;
        }));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      showToast('加载数据失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter data based on search
  const filteredUnits = unitRows.filter(u => 
    u.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLessons = lessonRows.filter(l =>
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.unitTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredChallenges = challengeRows.filter(c =>
    c.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Selection handlers
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const selectAll = () => {
    let ids: string[] = [];
    if (activeTab === 'units') ids = filteredUnits.map(u => u.id);
    else if (activeTab === 'lessons') ids = filteredLessons.map(l => l.id);
    else ids = filteredChallenges.map(c => c.id);
    
    if (selectedIds.size === ids.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  // Edit handlers - 不调用 onRefresh，避免跳转
  const startEdit = (id: string, data: any) => {
    setEditingId(id);
    setEditData({ ...data });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditData({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    
    setIsLoading(true);
    try {
      if (activeTab === 'units') {
        await apiClientV2.updateUnit(editingId, {
          title: editData.title,
          description: editData.description,
          color: editData.color
        });
      } else if (activeTab === 'lessons') {
        await apiClientV2.updateLesson(editingId, {
          title: editData.title
        });
      } else if (activeTab === 'challenges') {
        await apiClientV2.updateChallenge(editingId, {
          question: editData.question,
          correct_answer: editData.correct_answer,
          type: editData.type
        });
      }
      
      showToast('保存成功', 'success');
      cancelEdit();
      loadData(); // 只刷新当前表格数据，不调用 onRefresh
    } catch (error) {
      console.error('Failed to save:', error);
      showToast('保存失败', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Drag end handler
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    setIsLoading(true);
    try {
      if (activeTab === 'units') {
        const oldIndex = unitRows.findIndex(u => u.id === active.id);
        const newIndex = unitRows.findIndex(u => u.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const newRows: UnitRow[] = arrayMove(unitRows, oldIndex, newIndex);
          setUnitRows(newRows);
          
          // Update order_index in database
          for (let i = 0; i < newRows.length; i++) {
            if (newRows[i].order_index !== i) {
              await apiClientV2.updateUnit(newRows[i].id, { order_index: i });
            }
          }
          showToast('排序已保存', 'success');
        }
      } else if (activeTab === 'lessons') {
        // Only allow reordering within the same unit
        const activeLesson = lessonRows.find(l => l.id === active.id);
        const overLesson = lessonRows.find(l => l.id === over.id);
        
        if (activeLesson && overLesson && activeLesson.unit_id === overLesson.unit_id) {
          const unitLessons = lessonRows.filter(l => l.unit_id === activeLesson.unit_id);
          const oldIndex = unitLessons.findIndex(l => l.id === active.id);
          const newIndex = unitLessons.findIndex(l => l.id === over.id);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const newUnitLessons: LessonRow[] = arrayMove(unitLessons, oldIndex, newIndex);
            
            // Update local state
            const otherLessons = lessonRows.filter(l => l.unit_id !== activeLesson.unit_id);
            setLessonRows([...otherLessons, ...newUnitLessons].sort((a, b) => {
              if (a.unit_id !== b.unit_id) return a.unitTitle.localeCompare(b.unitTitle);
              return a.order_index - b.order_index;
            }));
            
            // Update order_index in database
            for (let i = 0; i < newUnitLessons.length; i++) {
              if (newUnitLessons[i].order_index !== i) {
                await apiClientV2.updateLesson(newUnitLessons[i].id, { order_index: i });
              }
            }
            showToast('排序已保存', 'success');
          }
        } else {
          showToast('只能在同一章节内排序，如需移动请使用"移动到"功能', 'error');
        }
      } else if (activeTab === 'challenges') {
        // Only allow reordering within the same lesson
        const activeChallenge = challengeRows.find(c => c.id === active.id);
        const overChallenge = challengeRows.find(c => c.id === over.id);
        
        if (activeChallenge && overChallenge && activeChallenge.lesson_id === overChallenge.lesson_id) {
          const lessonChallenges = challengeRows.filter(c => c.lesson_id === activeChallenge.lesson_id);
          const oldIndex = lessonChallenges.findIndex(c => c.id === active.id);
          const newIndex = lessonChallenges.findIndex(c => c.id === over.id);
          
          if (oldIndex !== -1 && newIndex !== -1) {
            const newLessonChallenges: ChallengeRow[] = arrayMove(lessonChallenges, oldIndex, newIndex);
            
            // Update local state
            const otherChallenges = challengeRows.filter(c => c.lesson_id !== activeChallenge.lesson_id);
            setChallengeRows([...otherChallenges, ...newLessonChallenges].sort((a, b) => {
              if (a.lesson_id !== b.lesson_id) return a.lessonTitle.localeCompare(b.lessonTitle);
              return a.order_index - b.order_index;
            }));
            
            // Update order_index in database
            for (let i = 0; i < newLessonChallenges.length; i++) {
              if (newLessonChallenges[i].order_index !== i) {
                await apiClientV2.updateChallenge(newLessonChallenges[i].id, { order_index: i });
              }
            }
            showToast('排序已保存', 'success');
          }
        } else {
          showToast('只能在同一课程内排序，如需移动请使用"移动到"功能', 'error');
        }
      }
    } catch (error) {
      console.error('Failed to reorder:', error);
      showToast('排序失败', 'error');
      loadData(); // Reload on error
    } finally {
      setIsLoading(false);
    }
  };

  // Delete handlers
  const confirmDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteModal({ 
      show: true, 
      ids: Array.from(selectedIds), 
      type: activeTab 
    });
  };

  const executeDelete = async () => {
    if (!deleteModal) return;
    
    setIsLoading(true);
    try {
      const { ids, type } = deleteModal;
      
      for (const id of ids) {
        if (type === 'units') {
          await apiClientV2.deleteUnit(id);
        } else if (type === 'lessons') {
          await apiClientV2.deleteLesson(id);
        } else if (type === 'challenges') {
          await apiClientV2.deleteChallenge(id);
        }
      }
      
      showToast(`成功删除 ${ids.length} 条记录`, 'success');
      setSelectedIds(new Set());
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
      showToast('删除失败', 'error');
    } finally {
      setIsLoading(false);
      setDeleteModal(null);
    }
  };

  // Move handlers (for lessons and challenges)
  const openMoveModal = () => {
    if (selectedIds.size === 0) return;
    if (activeTab === 'lessons') {
      setMoveModal({ show: true, ids: Array.from(selectedIds), type: 'lessons' });
      setTargetUnitId(unitRows[0]?.id || '');
    } else if (activeTab === 'challenges') {
      setMoveModal({ show: true, ids: Array.from(selectedIds), type: 'challenges' });
      setTargetLessonId(lessonRows[0]?.id || '');
    }
  };

  const executeMove = async () => {
    if (!moveModal) return;
    
    setIsLoading(true);
    try {
      const { ids, type } = moveModal;
      
      if (type === 'lessons' && targetUnitId) {
        for (const id of ids) {
          await apiClientV2.updateLesson(id, { unit_id: targetUnitId } as any);
        }
        showToast(`成功移动 ${ids.length} 个课程`, 'success');
      } else if (type === 'challenges' && targetLessonId) {
        for (const id of ids) {
          await apiClientV2.updateChallenge(id, { lesson_id: targetLessonId } as any);
        }
        showToast(`成功移动 ${ids.length} 个题目`, 'success');
      }
      
      setSelectedIds(new Set());
      loadData();
    } catch (error) {
      console.error('Failed to move:', error);
      showToast('移动失败', 'error');
    } finally {
      setIsLoading(false);
      setMoveModal(null);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'SINGLE_CHOICE': '单选',
      'MULTIPLE_CHOICE': '多选',
      'TRUE_FALSE': '判断',
      'FILL_BLANK': '填空'
    };
    return labels[type] || type;
  };

  const colorOptions = ['green', 'blue', 'purple', 'orange', 'rose', 'teal', 'yellow', 'indigo'];

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <FileText size={24} />
          数据表格管理
        </h2>
        <p className="text-indigo-100 text-sm mt-1">拖拽排序、批量编辑、移动和删除</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('units')}
          className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'units' 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <BookOpen size={18} />
          章节 ({unitRows.length})
        </button>
        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'lessons' 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <FileText size={18} />
          课程 ({lessonRows.length})
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={`flex-1 py-3 px-4 font-medium flex items-center justify-center gap-2 transition-colors ${
            activeTab === 'challenges' 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50' 
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          <HelpCircle size={18} />
          题目 ({challengeRows.length})
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-4 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="搜索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2 text-gray-700 transition-colors"
          >
            <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
            刷新
          </button>
          
          {selectedIds.size > 0 && (
            <>
              {(activeTab === 'lessons' || activeTab === 'challenges') && (
                <button
                  onClick={openMoveModal}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FolderInput size={18} />
                  移动到 ({selectedIds.size})
                </button>
              )}
              <button
                onClick={confirmDelete}
                className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Trash2 size={18} />
                删除 ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-h-[calc(100vh-400px)] min-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw size={32} className="animate-spin text-indigo-500" />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="w-10 px-2 py-3"></th>
                  <th className="w-12 px-4 py-3">
                    <button onClick={selectAll} className="text-gray-500 hover:text-gray-700">
                      {selectedIds.size > 0 && selectedIds.size === (
                        activeTab === 'units' ? filteredUnits.length :
                        activeTab === 'lessons' ? filteredLessons.length :
                        filteredChallenges.length
                      ) ? <CheckSquare size={20} /> : <Square size={20} />}
                    </button>
                  </th>
                  {activeTab === 'units' && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">标题</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">描述</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">颜色</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">课程数</th>
                      <th className="w-24 px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                    </>
                  )}
                  {activeTab === 'lessons' && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">所属章节</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">课程标题</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">题目数</th>
                      <th className="w-24 px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                    </>
                  )}
                  {activeTab === 'challenges' && (
                    <>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">所属课程</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">题型</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">题目</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">答案</th>
                      <th className="w-24 px-4 py-3 text-center text-sm font-medium text-gray-600">操作</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Units Table */}
                {activeTab === 'units' && (
                  <SortableContext items={filteredUnits.map(u => u.id)} strategy={verticalListSortingStrategy}>
                    {filteredUnits.map((unit) => (
                      <SortableRow key={unit.id} id={unit.id} disabled={!!searchTerm}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(unit.id)} className="text-gray-500 hover:text-gray-700">
                            {selectedIds.has(unit.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          {editingId === unit.id ? (
                            <input
                              type="text"
                              value={editData.title}
                              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                              className="w-full px-2 py-1 border rounded"
                            />
                          ) : (
                            <span className="font-medium">{unit.title}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm max-w-xs truncate">
                          {editingId === unit.id ? (
                            <input
                              type="text"
                              value={editData.description}
                              onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                              className="w-full px-2 py-1 border rounded"
                            />
                          ) : (
                            unit.description
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingId === unit.id ? (
                            <select
                              value={editData.color}
                              onChange={(e) => setEditData({ ...editData, color: e.target.value })}
                              className="px-2 py-1 border rounded"
                            >
                              {colorOptions.map(c => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2 py-1 rounded text-white text-xs bg-${unit.color}-500`}>
                              {unit.color}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{unit.lessonCount}</td>
                        <td className="px-4 py-3 text-center">
                          {editingId === unit.id ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Save size={18} />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => startEdit(unit.id, unit)} 
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <Edit3 size={18} />
                            </button>
                          )}
                        </td>
                      </SortableRow>
                    ))}
                  </SortableContext>
                )}

                {/* Lessons Table */}
                {activeTab === 'lessons' && (
                  <SortableContext items={filteredLessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
                    {filteredLessons.map((lesson) => (
                      <SortableRow key={lesson.id} id={lesson.id} disabled={!!searchTerm}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(lesson.id)} className="text-gray-500 hover:text-gray-700">
                            {selectedIds.has(lesson.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          <span className="px-2 py-1 bg-gray-100 rounded text-xs">{lesson.unitTitle}</span>
                        </td>
                        <td className="px-4 py-3">
                          {editingId === lesson.id ? (
                            <input
                              type="text"
                              value={editData.title}
                              onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                              className="w-full px-2 py-1 border rounded"
                            />
                          ) : (
                            <span className="font-medium">{lesson.title}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{lesson.challengeCount}</td>
                        <td className="px-4 py-3 text-center">
                          {editingId === lesson.id ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Save size={18} />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => startEdit(lesson.id, lesson)} 
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <Edit3 size={18} />
                            </button>
                          )}
                        </td>
                      </SortableRow>
                    ))}
                  </SortableContext>
                )}

                {/* Challenges Table */}
                {activeTab === 'challenges' && (
                  <SortableContext items={filteredChallenges.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {filteredChallenges.map((challenge) => (
                      <SortableRow key={challenge.id} id={challenge.id} disabled={!!searchTerm}>
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(challenge.id)} className="text-gray-500 hover:text-gray-700">
                            {selectedIds.has(challenge.id) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-sm">
                          <div className="text-xs">
                            <span className="px-2 py-1 bg-gray-100 rounded">{challenge.lessonTitle}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">{challenge.unitTitle}</div>
                        </td>
                        <td className="px-4 py-3">
                          {editingId === challenge.id ? (
                            <select
                              value={editData.type}
                              onChange={(e) => setEditData({ ...editData, type: e.target.value })}
                              className="px-2 py-1 border rounded text-sm"
                            >
                              <option value="SINGLE_CHOICE">单选</option>
                              <option value="MULTIPLE_CHOICE">多选</option>
                              <option value="TRUE_FALSE">判断</option>
                              <option value="FILL_BLANK">填空</option>
                            </select>
                          ) : (
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">{getTypeLabel(challenge.type)}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          {editingId === challenge.id ? (
                            <textarea
                              value={editData.question}
                              onChange={(e) => setEditData({ ...editData, question: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-sm"
                              rows={2}
                            />
                          ) : (
                            <span className="text-sm line-clamp-2">{challenge.question}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editingId === challenge.id ? (
                            <input
                              type="text"
                              value={editData.correct_answer}
                              onChange={(e) => setEditData({ ...editData, correct_answer: e.target.value })}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          ) : (
                            <span className="text-sm font-mono bg-green-50 px-2 py-1 rounded">{challenge.correct_answer}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {editingId === challenge.id ? (
                            <div className="flex gap-1 justify-center">
                              <button onClick={saveEdit} className="p-1 text-green-600 hover:bg-green-50 rounded">
                                <Save size={18} />
                              </button>
                              <button onClick={cancelEdit} className="p-1 text-gray-600 hover:bg-gray-100 rounded">
                                <X size={18} />
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => startEdit(challenge.id, challenge)} 
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <Edit3 size={18} />
                            </button>
                          )}
                        </td>
                      </SortableRow>
                    ))}
                  </SortableContext>
                )}

                {/* Empty state */}
                {((activeTab === 'units' && filteredUnits.length === 0) ||
                  (activeTab === 'lessons' && filteredLessons.length === 0) ||
                  (activeTab === 'challenges' && filteredChallenges.length === 0)) && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      {searchTerm ? '没有找到匹配的结果' : '暂无数据'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </DndContext>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t flex justify-between items-center text-sm text-gray-500">
        <span>
          共 {activeTab === 'units' ? filteredUnits.length : activeTab === 'lessons' ? filteredLessons.length : filteredChallenges.length} 条记录
          {selectedIds.size > 0 && ` (已选择 ${selectedIds.size} 条)`}
        </span>
        <span className="text-xs">
          💡 拖拽行首图标排序 | 选中后可批量移动或删除
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModal?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-500 mb-4">
              <AlertTriangle size={32} />
              <h3 className="text-xl font-bold">确认删除</h3>
            </div>
            <p className="text-gray-600 mb-6">
              确定要删除选中的 <strong>{deleteModal.ids.length}</strong> 条
              {deleteModal.type === 'units' ? '章节' : deleteModal.type === 'lessons' ? '课程' : '题目'}吗？
              {deleteModal.type === 'units' && (
                <span className="block mt-2 text-red-500 text-sm">
                  ⚠️ 删除章节将同时删除其下所有课程和题目！
                </span>
              )}
              {deleteModal.type === 'lessons' && (
                <span className="block mt-2 text-red-500 text-sm">
                  ⚠️ 删除课程将同时删除其下所有题目！
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModal(null)}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Trash2 size={18} />}
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Modal */}
      {moveModal?.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-500 mb-4">
              <FolderInput size={32} />
              <h3 className="text-xl font-bold">移动到</h3>
            </div>
            <p className="text-gray-600 mb-4">
              将选中的 <strong>{moveModal.ids.length}</strong> 个
              {moveModal.type === 'lessons' ? '课程' : '题目'}移动到：
            </p>
            
            {moveModal.type === 'lessons' && (
              <select
                value={targetUnitId}
                onChange={(e) => setTargetUnitId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-6"
              >
                {unitRows.map(u => (
                  <option key={u.id} value={u.id}>{u.title}</option>
                ))}
              </select>
            )}
            
            {moveModal.type === 'challenges' && (
              <select
                value={targetLessonId}
                onChange={(e) => setTargetLessonId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg mb-6"
              >
                {lessonRows.map(l => (
                  <option key={l.id} value={l.id}>{l.unitTitle} → {l.title}</option>
                ))}
              </select>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setMoveModal(null)}
                className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeMove}
                disabled={isLoading}
                className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <FolderInput size={18} />}
                确认移动
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg shadow-lg text-white z-50 ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
