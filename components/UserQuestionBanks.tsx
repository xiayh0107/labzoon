import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Edit3, Save, X, BookOpen, FolderPlus, ChevronRight, 
  ChevronDown, Sparkles, Loader2, CheckSquare, Square, AlertCircle,
  Play, Settings, Image as ImageIcon, MoreVertical
} from 'lucide-react';
import { QuestionType, Challenge } from '../types';
import { userBankApi, UserQuestionBank, UserBankSection, UserBankChallenge } from '../apiClient';
import { apiClient } from '../apiClient';
import { getAIConfig } from '../api';
import { generateImageFromText, toBase64, generateOptions, fetchAIConfig } from '../hooks/useAIGenerator';
import { supabase } from '../supabase';

interface UserQuestionBanksProps {
  onStartPractice?: (bankId: string, sectionId: string, challenges: Challenge[]) => void;
}

// 题库颜色选项
const BANK_COLORS = [
  { name: 'blue', bg: 'bg-blue-500', light: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' },
  { name: 'green', bg: 'bg-green-500', light: 'bg-green-50', text: 'text-green-600', border: 'border-green-200' },
  { name: 'purple', bg: 'bg-purple-500', light: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-200' },
  { name: 'orange', bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200' },
  { name: 'pink', bg: 'bg-pink-500', light: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200' },
  { name: 'indigo', bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-600', border: 'border-indigo-200' },
];

// 题库图标选项
const BANK_ICONS = ['📚', '🎯', '💡', '🧪', '📖', '🎓', '🔬', '💻', '🌟', '🏆'];

export default function UserQuestionBanks({ onStartPractice }: UserQuestionBanksProps) {
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // 数据状态
  const [banks, setBanks] = useState<UserQuestionBank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // UI 状态
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [expandedBanks, setExpandedBanks] = useState<Set<string>>(new Set());
  
  // 编辑状态
  const [editingBank, setEditingBank] = useState<Partial<UserQuestionBank> | null>(null);
  const [editingSection, setEditingSection] = useState<{ bankId: string; section: Partial<UserBankSection> } | null>(null);
  const [editingChallenge, setEditingChallenge] = useState<Partial<UserBankChallenge> | null>(null);
  const [isImageGenLoading, setIsImageGenLoading] = useState(false);
  const [isOptionGenLoading, setIsOptionGenLoading] = useState(false);
  
  // 题目列表
  const [challenges, setChallenges] = useState<UserBankChallenge[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);
  const [selectedChallengeIds, setSelectedChallengeIds] = useState<Set<string>>(new Set());

  // AI 生成状态
  // AI 生成相关状态已移除
  
  // Toast & Modal
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // 获取颜色样式
  const getColorStyle = (colorName: string) => {
    return BANK_COLORS.find(c => c.name === colorName) || BANK_COLORS[0];
  };

  // 显示 Toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // 加载题库列表
  useEffect(() => {
    loadBanks();
    
    // 监听题库数据变化事件
    const handleBankDataChanged = () => {
      loadBanks();
    };
    
    window.addEventListener('userBankDataChanged', handleBankDataChanged);
    
    return () => {
      window.removeEventListener('userBankDataChanged', handleBankDataChanged);
    };
  }, []);

  const loadBanks = async () => {
    try {
      setLoading(true);
      const data = await userBankApi.fetchBanks();
      setBanks(data);
      
      // 如果有题库，默认展开第一个
      if (data.length > 0) {
        setExpandedBanks(new Set([data[0].id]));
      }
    } catch (error: any) {
      showToast(error.message || '加载题库失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 加载章节题目
  const loadChallenges = async (sectionId: string) => {
    try {
      setLoadingChallenges(true);
      const data = await userBankApi.fetchChallenges(sectionId);
      setChallenges(data);
      setSelectedChallengeIds(new Set());
    } catch (error: any) {
      showToast(error.message || '加载题目失败', 'error');
    } finally {
      setLoadingChallenges(false);
    }
  };

  // 选择章节
  const handleSelectSection = (bankId: string, sectionId: string) => {
    setSelectedBankId(bankId);
    setSelectedSectionId(sectionId);
    loadChallenges(sectionId);
  };

  // 创建/更新题库
  const handleSaveBank = async () => {
    if (!editingBank?.title?.trim()) {
      showToast('请输入题库名称', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (editingBank.id) {
        // 更新
        await userBankApi.updateBank(editingBank.id, {
          title: editingBank.title,
          description: editingBank.description,
          color: editingBank.color,
          icon: editingBank.icon
        });
        setBanks(prev => prev.map(b => 
          b.id === editingBank.id ? { ...b, ...editingBank } as UserQuestionBank : b
        ));
        showToast('题库已更新', 'success');
      } else {
        // 创建
        const newBank = await userBankApi.createBank({
          title: editingBank.title,
          description: editingBank.description,
          color: editingBank.color || 'blue',
          icon: editingBank.icon || '📚'
        });
        setBanks(prev => [...prev, { ...newBank, sections: [], totalChallenges: 0 }]);
        setExpandedBanks(prev => new Set(prev).add(newBank.id));
        showToast('题库已创建', 'success');
      }
      
      setEditingBank(null);
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 删除题库
  const handleDeleteBank = (bank: UserQuestionBank) => {
    setModal({
      title: '删除题库',
      message: `确定要删除题库"${bank.title}"吗？该操作将删除其中所有章节和题目，且不可恢复。`,
      onConfirm: async () => {
        try {
          await userBankApi.deleteBank(bank.id);
          setBanks(prev => prev.filter(b => b.id !== bank.id));
          if (selectedBankId === bank.id) {
            setSelectedBankId(null);
            setSelectedSectionId(null);
            setChallenges([]);
          }
          showToast('题库已删除', 'success');
        } catch (error: any) {
          showToast(error.message || '删除失败', 'error');
        }
        setModal(null);
      }
    });
  };

  // 创建/更新章节
  const handleSaveSection = async () => {
    if (!editingSection?.section.title?.trim()) {
      showToast('请输入章节名称', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (editingSection.section.id) {
        // 更新
        await userBankApi.updateSection(editingSection.section.id, {
          title: editingSection.section.title
        });
        setBanks(prev => prev.map(b => ({
          ...b,
          sections: b.sections?.map(s => 
            s.id === editingSection.section.id 
              ? { ...s, title: editingSection.section.title! } 
              : s
          )
        })));
        showToast('章节已更新', 'success');
      } else {
        // 创建
        const newSection = await userBankApi.createSection(
          editingSection.bankId, 
          editingSection.section.title
        );
        setBanks(prev => prev.map(b => 
          b.id === editingSection.bankId 
            ? { ...b, sections: [...(b.sections || []), { ...newSection, challengeCount: 0 }] }
            : b
        ));
        showToast('章节已创建', 'success');
      }
      
      setEditingSection(null);
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 删除章节
  const handleDeleteSection = (bankId: string, section: UserBankSection) => {
    setModal({
      title: '删除章节',
      message: `确定要删除章节"${section.title}"吗？该操作将删除其中所有题目，且不可恢复。`,
      onConfirm: async () => {
        try {
          await userBankApi.deleteSection(section.id);
          setBanks(prev => prev.map(b => 
            b.id === bankId 
              ? { ...b, sections: b.sections?.filter(s => s.id !== section.id) }
              : b
          ));
          if (selectedSectionId === section.id) {
            setSelectedSectionId(null);
            setChallenges([]);
          }
          showToast('章节已删除', 'success');
        } catch (error: any) {
          showToast(error.message || '删除失败', 'error');
        }
        setModal(null);
      }
    });
  };

  // 保存题目
  const handleSaveChallenge = async () => {
    if (!editingChallenge?.question?.trim() || !selectedSectionId) {
      showToast('请填写题目内容', 'error');
      return;
    }

    try {
      setSaving(true);
      
      if (editingChallenge.id) {
        // 更新
        await userBankApi.updateChallenge(editingChallenge.id, {
          type: editingChallenge.type,
          question: editingChallenge.question,
          correct_answer: editingChallenge.correct_answer,
          options: editingChallenge.options,
          explanation: editingChallenge.explanation,
          image_url: editingChallenge.image_url
        });
        setChallenges(prev => prev.map(c => 
          c.id === editingChallenge.id ? { ...c, ...editingChallenge } as UserBankChallenge : c
        ));
        showToast('题目已更新', 'success');
      } else {
        // 创建
        const newChallenge = await userBankApi.createChallenge(selectedSectionId, {
          type: editingChallenge.type || 'SINGLE_CHOICE',
          question: editingChallenge.question,
          correct_answer: editingChallenge.correct_answer || '',
          options: editingChallenge.options,
          explanation: editingChallenge.explanation,
          image_url: editingChallenge.image_url
        });
        setChallenges(prev => [...prev, newChallenge]);
        
        // 更新章节题目数量
        setBanks(prev => prev.map(b => ({
          ...b,
          sections: b.sections?.map(s => 
            s.id === selectedSectionId 
              ? { ...s, challengeCount: (s.challengeCount || 0) + 1 }
              : s
          ),
          totalChallenges: b.sections?.some(s => s.id === selectedSectionId)
            ? (b.totalChallenges || 0) + 1
            : b.totalChallenges
        })));
        
        showToast('题目已添加', 'success');
      }
      
      setEditingChallenge(null);
    } catch (error: any) {
      showToast(error.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSingleGenImage = async () => {
    if (!editingChallenge || !editingChallenge.question) return;
    setIsImageGenLoading(true);
    try {
      const answerText = editingChallenge.correct_answer || '';
      const img = await generateImageFromText(editingChallenge.question, answerText, userId);
      if (img) {
        setEditingChallenge({ ...editingChallenge, image_url: img });
        showToast('配图生成成功', 'success');
      } else {
        showToast('配图生成失败，请重试', 'error');
      }
    } finally {
      setIsImageGenLoading(false);
    }
  };

  const handleChallengeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && editingChallenge) {
      const base64 = await toBase64(e.target.files[0]);
      setEditingChallenge({ ...editingChallenge, image_url: base64 });
    }
  };

  const handleGenerateOptions = async () => {
    if (!editingChallenge || !editingChallenge.question) return;
    setIsOptionGenLoading(true);
    try {
      const options = await generateOptions(editingChallenge.question, editingChallenge.type || 'SINGLE_CHOICE', userId);
      if (options && options.length > 0) {
        setEditingChallenge(prev => ({
          ...prev!,
          options: options,
          correct_answer: prev?.correct_answer || options[0].id
        }));
        showToast('选项生成成功', 'success');
      } else {
        showToast('生成失败，请重试', 'error');
      }
    } catch (e: any) {
      showToast(e.message || '生成出错', 'error');
    } finally {
      setIsOptionGenLoading(false);
    }
  };

  // 删除选中的题目
  const handleDeleteSelectedChallenges = () => {
    if (selectedChallengeIds.size === 0) return;
    
    setModal({
      title: '删除题目',
      message: `确定要删除选中的 ${selectedChallengeIds.size} 道题目吗？`,
      onConfirm: async () => {
        try {
          await userBankApi.deleteChallengesBatch(Array.from(selectedChallengeIds));
          setChallenges(prev => prev.filter(c => !selectedChallengeIds.has(c.id)));
          
          // 更新章节题目数量
          const deletedCount = selectedChallengeIds.size;
          setBanks(prev => prev.map(b => ({
            ...b,
            sections: b.sections?.map(s => 
              s.id === selectedSectionId 
                ? { ...s, challengeCount: Math.max(0, (s.challengeCount || 0) - deletedCount) }
                : s
            ),
            totalChallenges: b.sections?.some(s => s.id === selectedSectionId)
              ? Math.max(0, (b.totalChallenges || 0) - deletedCount)
              : b.totalChallenges
          })));
          
          setSelectedChallengeIds(new Set());
          showToast('题目已删除', 'success');
        } catch (error: any) {
          showToast(error.message || '删除失败', 'error');
        }
        setModal(null);
      }
    });
  };

  // AI 生成题目
  // AI 生成题目相关逻辑已移除

  // 开始练习
  const handleStartPractice = () => {
    if (!selectedBankId || !selectedSectionId || challenges.length === 0) {
      showToast('请先选择包含题目的章节', 'error');
      return;
    }

    // 转换为 Challenge 格式
    const practiceQuestions: Challenge[] = challenges.map(c => ({
      id: c.id,
      type: c.type as QuestionType,
      question: c.question,
      options: c.options,
      correctAnswer: c.correct_answer,
      explanation: c.explanation || '',
      imageUrl: c.image_url
    }));

    onStartPractice?.(selectedBankId, selectedSectionId, practiceQuestions);
  };

  // 获取当前选中的题库和章节
  const selectedBank = banks.find(b => b.id === selectedBankId);
  const selectedSection = selectedBank?.sections?.find(s => s.id === selectedSectionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800">
            <BookOpen className="text-blue-500" /> 我的题库
          </h2>
          <p className="text-gray-500 text-sm mt-1">创建和管理您的私人学习题库</p>
        </div>
        
        <button
          onClick={() => setEditingBank({ title: '', description: '', color: 'blue', icon: '📚' })}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl font-bold transition-all"
        >
          <Plus size={18} /> 创建题库
        </button>
      </div>

      {banks.length === 0 ? (
        /* 空状态 */
        <div className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <BookOpen size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold text-gray-600 mb-2">还没有题库</h3>
          <p className="text-gray-400 mb-6">创建您的第一个私人题库，开始自主学习之旅</p>
          <button
            onClick={() => setEditingBank({ title: '', description: '', color: 'blue', icon: '📚' })}
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all"
          >
            <Plus size={18} /> 创建题库
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：题库列表 */}
          <div className="lg:col-span-1 space-y-4">
            {banks.map(bank => {
              const colorStyle = getColorStyle(bank.color);
              const isExpanded = expandedBanks.has(bank.id);
              
              return (
                <div 
                  key={bank.id} 
                  className={`bg-white rounded-xl border-2 ${
                    selectedBankId === bank.id ? colorStyle.border : 'border-gray-100'
                  } overflow-hidden shadow-sm`}
                >
                  {/* 题库头部 */}
                  <div 
                    className={`p-4 cursor-pointer ${colorStyle.light} border-b ${colorStyle.border}`}
                    onClick={() => {
                      setExpandedBanks(prev => {
                        const next = new Set(prev);
                        if (next.has(bank.id)) {
                          next.delete(bank.id);
                        } else {
                          next.add(bank.id);
                        }
                        return next;
                      });
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{bank.icon}</span>
                        <div>
                          <h3 className={`font-bold ${colorStyle.text}`}>{bank.title}</h3>
                          <p className="text-xs text-gray-500">
                            {bank.sections?.length || 0} 章节 · {bank.totalChallenges || 0} 题目
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingBank(bank); }}
                          className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                        >
                          <Edit3 size={14} className="text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteBank(bank); }}
                          className="p-1.5 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                    </div>
                  </div>

                  {/* 章节列表 */}
                  {isExpanded && (
                    <div className="p-2">
                      {bank.sections?.map(section => (
                        <div
                          key={section.id}
                          className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedSectionId === section.id 
                              ? `${colorStyle.light} ${colorStyle.border} border` 
                              : 'hover:bg-gray-50'
                          }`}
                          onClick={() => handleSelectSection(bank.id, section.id)}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${colorStyle.bg}`}></span>
                            <span className="font-medium text-gray-700">{section.title}</span>
                            <span className="text-xs text-gray-400">({section.challengeCount || 0}题)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                setEditingSection({ bankId: bank.id, section });
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                            >
                              <Edit3 size={12} className="text-gray-400" />
                            </button>
                            <button
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleDeleteSection(bank.id, section);
                              }}
                              className="p-1 hover:bg-red-100 rounded"
                            >
                              <Trash2 size={12} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* 添加章节按钮 */}
                      <button
                        onClick={() => setEditingSection({ bankId: bank.id, section: { title: '' } })}
                        className="w-full flex items-center justify-center gap-2 p-3 mt-2 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
                      >
                        <FolderPlus size={16} /> 添加章节
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 右侧：题目管理 */}
          <div className="lg:col-span-2">
            {selectedSectionId ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                {/* 章节头部 */}
                <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">
                      {selectedBank?.title} / {selectedSection?.title}
                    </h3>
                    <p className="text-sm text-gray-500">{challenges.length} 道题目</p>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {selectedChallengeIds.size > 0 && (
                      <button
                        onClick={handleDeleteSelectedChallenges}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} /> 删除选中 ({selectedChallengeIds.size})
                      </button>
                    )}
                    {/* AI 生成入口已移除 */}
                    <button
                      onClick={() => setEditingChallenge({ type: 'SINGLE_CHOICE', question: '', options: [], correct_answer: '', explanation: '' })}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                    >
                      <Plus size={14} /> 添加题目
                    </button>
                    {challenges.length > 0 && (
                      <button
                        onClick={handleStartPractice}
                        className="flex items-center gap-1 px-4 py-1.5 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 transition-colors"
                      >
                        <Play size={14} /> 开始练习
                      </button>
                    )}
                  </div>
                </div>

                {/* 题目列表 */}
                <div className="p-4 max-h-[600px] overflow-y-auto">
                  {loadingChallenges ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="animate-spin text-gray-300" size={24} />
                    </div>
                  ) : challenges.length === 0 ? (
                    <div className="text-center py-12">
                      <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-400">暂无题目，点击上方按钮添加</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {challenges.map((challenge, index) => (
                        <div
                          key={challenge.id}
                          className={`p-4 rounded-xl border ${
                            selectedChallengeIds.has(challenge.id) 
                              ? 'border-blue-300 bg-blue-50' 
                              : 'border-gray-100 bg-gray-50'
                          } hover:border-gray-200 transition-colors`}
                        >
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => {
                                setSelectedChallengeIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(challenge.id)) {
                                    next.delete(challenge.id);
                                  } else {
                                    next.add(challenge.id);
                                  }
                                  return next;
                                });
                              }}
                              className="mt-1"
                            >
                              {selectedChallengeIds.has(challenge.id) 
                                ? <CheckSquare size={18} className="text-blue-500" />
                                : <Square size={18} className="text-gray-300" />
                              }
                            </button>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                                  {index + 1}
                                </span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  challenge.type === 'SINGLE_CHOICE' ? 'bg-blue-100 text-blue-600' :
                                  challenge.type === 'MULTIPLE_CHOICE' ? 'bg-purple-100 text-purple-600' :
                                  challenge.type === 'TRUE_FALSE' ? 'bg-green-100 text-green-600' :
                                  'bg-orange-100 text-orange-600'
                                }`}>
                                  {challenge.type === 'SINGLE_CHOICE' ? '单选' :
                                   challenge.type === 'MULTIPLE_CHOICE' ? '多选' :
                                   challenge.type === 'TRUE_FALSE' ? '判断' : '填空'}
                                </span>
                              </div>
                              
                              <p className="text-gray-800 font-medium line-clamp-2">{challenge.question}</p>
                              
                              {challenge.options && challenge.options.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {challenge.options.map(opt => (
                                    <span 
                                      key={opt.id} 
                                      className={`text-xs px-2 py-1 rounded ${
                                        challenge.correct_answer.split(',').includes(opt.id)
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-gray-100 text-gray-600'
                                      }`}
                                    >
                                      {opt.id}. {opt.text.length > 20 ? opt.text.substring(0, 20) + '...' : opt.text}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setEditingChallenge(challenge)}
                                className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                <Edit3 size={14} className="text-gray-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center h-64">
                <div className="text-center text-gray-400">
                  <ChevronRight size={32} className="mx-auto mb-2" />
                  <p>选择左侧的章节查看题目</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 编辑题库弹窗 */}
      {editingBank && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">
              {editingBank.id ? '编辑题库' : '创建题库'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">题库名称</label>
                <input
                  type="text"
                  value={editingBank.title || ''}
                  onChange={(e) => setEditingBank({ ...editingBank, title: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder="例如：高等数学"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">描述（可选）</label>
                <textarea
                  value={editingBank.description || ''}
                  onChange={(e) => setEditingBank({ ...editingBank, description: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  rows={2}
                  placeholder="简单描述这个题库的内容"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择颜色</label>
                <div className="flex gap-2">
                  {BANK_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => setEditingBank({ ...editingBank, color: color.name })}
                      className={`w-8 h-8 rounded-full ${color.bg} ${
                        editingBank.color === color.name ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">选择图标</label>
                <div className="flex flex-wrap gap-2">
                  {BANK_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setEditingBank({ ...editingBank, icon })}
                      className={`w-10 h-10 text-xl rounded-lg border-2 ${
                        editingBank.icon === icon 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingBank(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveBank}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑章节弹窗 */}
      {editingSection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-4">
              {editingSection.section.id ? '编辑章节' : '添加章节'}
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">章节名称</label>
              <input
                type="text"
                value={editingSection.section.title || ''}
                onChange={(e) => setEditingSection({ 
                  ...editingSection, 
                  section: { ...editingSection.section, title: e.target.value }
                })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
                placeholder="例如：第一章 函数与极限"
              />
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditingSection(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveSection}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑题目弹窗 */}
      {editingChallenge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl my-8">
            <h3 className="text-lg font-bold mb-4">
              {editingChallenge.id ? '编辑题目' : '添加题目'}
            </h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* 题目类型 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">题目类型</label>
                <div className="flex gap-2">
                  {[
                    { type: 'SINGLE_CHOICE', label: '单选题' },
                    { type: 'MULTIPLE_CHOICE', label: '多选题' },
                    { type: 'TRUE_FALSE', label: '判断题' },
                    { type: 'FILL_BLANK', label: '填空题' }
                  ].map(({ type, label }) => (
                    <button
                      key={type}
                      onClick={() => {
                        const newOptions = type === 'TRUE_FALSE' 
                          ? [{ id: 'A', text: '正确' }, { id: 'B', text: '错误' }]
                          : editingChallenge.options || [];
                        setEditingChallenge({ ...editingChallenge, type, options: newOptions });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        editingChallenge.type === type
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 题目内容 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">题目内容</label>
                <textarea
                  value={editingChallenge.question || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, question: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  rows={3}
                  placeholder="请输入题目内容"
                />
              </div>
              {/* 选项（选择题和判断题） */}
              {editingChallenge.type !== 'FILL_BLANK' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">选项</label>
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-xs text-gray-400">最多 6 个选项</div>
                    <button
                      onClick={handleGenerateOptions}
                      disabled={isOptionGenLoading || !editingChallenge.question}
                      className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1 transition-colors"
                    >
                      {isOptionGenLoading ? <Loader2 size={12} className="animate-spin" /> : '✨'} AI 生成选项
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(editingChallenge.options || []).map((opt, idx) => (
                      <div key={opt.id} className="flex items-center gap-2">
                        <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg font-bold text-gray-600">
                          {opt.id}
                        </span>
                        <input
                          type="text"
                          value={opt.text}
                          onChange={(e) => {
                            const newOptions = [...(editingChallenge.options || [])];
                            newOptions[idx] = { ...opt, text: e.target.value };
                            setEditingChallenge({ ...editingChallenge, options: newOptions });
                          }}
                          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-200 outline-none"
                          placeholder={`选项 ${opt.id}`}
                          disabled={editingChallenge.type === 'TRUE_FALSE'}
                        />
                        {editingChallenge.type !== 'TRUE_FALSE' && (
                          <button
                            onClick={() => {
                              const newOptions = (editingChallenge.options || []).filter((_, i) => i !== idx);
                              setEditingChallenge({ ...editingChallenge, options: newOptions });
                            }}
                            className="p-1.5 hover:bg-red-100 rounded-lg"
                          >
                            <X size={14} className="text-red-400" />
                          </button>
                        )}
                      </div>
                    ))}
                    {editingChallenge.type !== 'TRUE_FALSE' && (editingChallenge.options?.length || 0) < 6 && (
                      <button
                        onClick={() => {
                          const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
                          const nextLetter = letters[(editingChallenge.options?.length || 0)];
                          setEditingChallenge({
                            ...editingChallenge,
                            options: [...(editingChallenge.options || []), { id: nextLetter, text: '' }]
                          });
                        }}
                        className="text-blue-500 text-sm font-medium hover:text-blue-600"
                      >
                        + 添加选项
                      </button>
                    )}
                  </div>
                </div>
              )}
              {/* 正确答案 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  正确答案
                  {editingChallenge.type === 'MULTIPLE_CHOICE' && (
                    <span className="text-gray-400 font-normal">（多选用逗号分隔，如 A,B,C）</span>
                  )}
                </label>
                <input
                  type="text"
                  value={editingChallenge.correct_answer || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, correct_answer: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none"
                  placeholder={editingChallenge.type === 'FILL_BLANK' ? '请输入正确答案' : '例如：A 或 A,B'}
                />
              </div>
              {/* 配图 */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">图片（可选）</label>
                  <button
                    onClick={handleSingleGenImage}
                    disabled={isImageGenLoading || !editingChallenge?.question}
                    className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold hover:bg-yellow-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isImageGenLoading ? <Loader2 size={12} className="animate-spin" /> : '🍌'} AI 生成配图
                  </button>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center relative overflow-hidden group">
                    {editingChallenge?.image_url ? (
                      <img src={editingChallenge.image_url} alt="preview" className="w-full h-full object-contain" />
                    ) : (
                      <ImageIcon className="text-gray-300" />
                    )}
                    <input type="file" accept="image/*" onChange={handleChallengeImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <span className="text-white text-xs font-bold">点击上传</span>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 mt-2 flex-1">
                    点击左侧方块上传本地图片，或者点击上方 🍌 按钮让 AI 自动生成。
                    {editingChallenge?.image_url && (
                      <button onClick={() => setEditingChallenge({ ...editingChallenge, image_url: undefined })} className="block mt-2 text-red-500 hover:underline">删除当前图片</button>
                    )}
                  </div>
                </div>
              </div>
              {/* 解析 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">解析（可选）</label>
                <textarea
                  value={editingChallenge.explanation || ''}
                  onChange={(e) => setEditingChallenge({ ...editingChallenge, explanation: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  rows={2}
                  placeholder="题目解析，帮助用户理解"
                />
              </div>
              {/* 自动保存状态反馈 */}
              <div className="pt-2">
                <span className="text-xs font-bold text-green-500 flex items-center gap-1">
                  <CheckSquare size={14}/> 已自动保存
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => setEditingChallenge(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI 生成弹窗 */}
      {/* AI 生成弹窗已移除 */}

      {/* 确认弹窗 */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold mb-2">{modal.title}</h3>
            <p className="text-gray-600 mb-6">{modal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                取消
              </button>
              <button
                onClick={modal.onConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          'bg-gray-800 text-white'
        }`}>
          {toast.type === 'success' && <CheckSquare size={18} />}
          {toast.type === 'error' && <AlertCircle size={18} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
