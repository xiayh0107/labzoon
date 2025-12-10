import React, { useMemo, useState } from 'react';
import { Sparkles, Loader2, FileText, Image as ImageIcon, Upload, Trash2, AlertTriangle } from 'lucide-react';
import { KnowledgeItem } from '../types';
import { checkDuplicate } from '../api';
import {
  frontendGenerateQuestions,
  frontendGenerateStructure,
  fileToGenerative,
  fetchAIConfig,
  submitBackgroundQuestionsTask,
  submitBackgroundStructureTask
} from '../hooks/useAIGenerator';
import { apiClientV2 } from '../apiClient';
import { userBankApi, UserQuestionBank, UserBankSection, apiClient } from '../apiClient';
import { supabase } from '../supabase';

interface PersonalGeneratorProps {
  knowledgeBase: KnowledgeItem[];
  setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
}

export default function PersonalGenerator({ knowledgeBase, setKnowledgeBase }: PersonalGeneratorProps) {
  // Get current user ID for AI config isolation
  const [userId, setUserId] = useState<string>('');
  
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const [inputSource, setInputSource] = useState<'new' | 'library'>('new');
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
  const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [contentTitle, setContentTitle] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saveToKb, setSaveToKb] = useState(true);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<any[]>([]);
  const [useSmartStructure, setUseSmartStructure] = useState(false);
  const [taskSubmitted, setTaskSubmitted] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');

  const [banks, setBanks] = useState<UserQuestionBank[]>([]);
  const [sections, setSections] = useState<UserBankSection[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true); // 默认开启自动保存
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const duplicateItem = useMemo(() => {
    if (inputSource === 'new' && inputMode === 'text') {
      return checkDuplicate(textContent, knowledgeBase);
    }
    return null;
  }, [textContent, knowledgeBase, inputSource, inputMode]);

  React.useEffect(() => {
    userBankApi.fetchBanks().then((list) => {
      setBanks(list);
      const first = list[0];
      if (first) {
        setSelectedBankId(first.id);
        setSections(first.sections || []);
        const firstSection = (first.sections || [])[0];
        if (firstSection) setSelectedSectionId(firstSection.id);
      }
    }).catch(console.error);
  }, []);

  // 自动保存到个人题库的函数
  const autoSaveToUserBank = async (taskResult: any) => {
    if (!autoSaveEnabled || !taskResult) return;
    
    setIsAutoSaving(true);
    try {
      let challenges: any[] = [];
      
      if (taskResult.questions) {
        challenges = taskResult.questions;
      } else {
        challenges = Array.isArray(taskResult) ? taskResult : [];
      }
      
      if (challenges.length === 0) {
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

      // 获取或创建"AI生成"题库
      const banks = await userBankApi.fetchBanks();
      let targetBank: UserQuestionBank | undefined = banks.find(b => b.title === 'AI生成');
      
      if (!targetBank) {
        targetBank = await userBankApi.createBank({
          title: 'AI生成',
          description: '由 AI 生成的题目',
          color: 'purple',
          icon: '🧠'
        });
      }
      
      // 获取或创建"自动生成"章节
      const banksWithSections = await userBankApi.fetchBanks();
      const updatedTargetBank = banksWithSections.find(b => b.id === targetBank!.id);
      const existingSections = updatedTargetBank?.sections || [];
      let targetSection: UserBankSection | undefined = existingSections.find(s => s.title === '自动生成');
      
      if (!targetSection) {
        targetSection = await userBankApi.createSection(targetBank.id, '自动生成');
      }
      
      // 保存题目到用户题库
      if (targetSection?.id) {
        await userBankApi.createChallengesBatch(targetSection.id, formattedChallenges);
        
        // 更新界面状态，显示自动保存成功
        const savedCount = formattedChallenges.length;
        const invalidCount = taskResult.invalidCount || 0;
        
        console.log(`✅ 自动保存成功: ${savedCount} 道题目已保存到个人题库`);
        
        // 触发用户题库刷新事件
        window.dispatchEvent(new CustomEvent('userBankDataChanged'));
      } else {
        throw new Error('无法创建章节');
      }
    } catch (error: any) {
      console.error('自动保存到个人题库失败:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };

  const handleBankChange = (id: string) => {
    setSelectedBankId(id);
    const bank = banks.find(b => b.id === id);
    const secs = bank?.sections || [];
    setSections(secs);
    setSelectedSectionId(secs[0]?.id || '');
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setContentTitle(file.name.split('.')[0]);
    }
  };

  // 完全对齐 AdminGenerator 的 handleGenerate
  const handleGenerate = async () => {
    // Validate Inputs
    let finalPromptText = '';
    let finalImagePart = null;

    if (inputSource === 'library') {
      const item = knowledgeBase.find(k => k.id === selectedLibraryId);
      if (!item) return;
      finalPromptText = item.content;
    } else {
      if ((inputMode === 'text' && !textContent.trim()) || (inputMode === 'image' && !imageFile)) {
        alert('请提供内容');
        return;
      }
      finalPromptText = textContent;
      if (inputMode === 'image' && imageFile) {
        finalImagePart = await fileToGenerative(imageFile);
      }
    }

    // 获取AI配置
    const aiConfig = await fetchAIConfig(userId);
    // 检查是否可以使用后台任务模式（有userId且不是图片模式）
    const canUseBackgroundTask = userId && !finalImagePart;

    if (canUseBackgroundTask) {
      setIsGenerating(true);
      setLoadingStep('正在提交任务到后台...');
      setTaskSubmitted(false);
      try {
        if (useSmartStructure && inputMode === 'text') {
          const { taskId } = await submitBackgroundStructureTask(
            userId,
            finalPromptText,
            aiConfig.systemPromptStructure || '',
            aiConfig,
            contentTitle || '智能结构化生成'
          );
          setTaskSubmitted(true);
          setLoadingStep('任务已提交！AI 正在后台处理，完成后将自动保存到个人题库。');
        } else {
          const promptPrefix = '请根据以下内容生成题目:\n';
          const { taskId } = await submitBackgroundQuestionsTask(
            userId,
            `${promptPrefix}${finalPromptText}`,
            aiConfig.systemPromptText || '',
            aiConfig,
            contentTitle || '生成题目'
          );
          setTaskSubmitted(true);
          setLoadingStep('任务已提交！AI 正在后台处理，完成后将自动保存到个人题库。');
        }
        // 保存到知识库
        if (inputSource === 'new' && saveToKb && !duplicateItem) {
          const newItem: KnowledgeItem = {
            id: `kb-${Date.now()}`,
            title: contentTitle || textContent.slice(0, 15) + '...',
            content: textContent,
            type: 'text',
            createdAt: Date.now()
          };
          setKnowledgeBase(prev => [newItem, ...prev]);
        }
        setTimeout(() => {
          setIsGenerating(false);
          setLoadingStep('');
          setTextContent('');
          setContentTitle('');
        }, 2000);
      } catch (error) {
        console.error(error);
        alert('任务提交失败');
        setIsGenerating(false);
        setLoadingStep('');
      }
      return;
    }

    // === 前端直接执行模式 (图片模式或无userId时的降级方案) ===
    setIsGenerating(true);
    setLoadingStep('正在连接 AI 大脑...');
    setGenerated([]);
    try {
      const promptPrefix = inputMode === 'text' 
        ? `请根据以下内容生成题目:\n` 
        : `请分析这张图片中的医学知识点，并生成题目。`;
      const questions = await frontendGenerateQuestions(
        inputMode === 'text' ? `${promptPrefix}${finalPromptText}` : promptPrefix,
        finalImagePart,
        userId
      );
      setGenerated(questions);
      if (questions.length === 0) {
        throw new Error('未能生成题目，请重试');
      }
    } catch (error) {
      console.error(error);
      alert(`生成失败: ${error.message || '可能内容过长或网络超时。'}`);
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  };

  // 对齐 AdminGenerator 的 saveToLesson 逻辑
  const handleSaveToSection = async () => {
    if (!selectedSectionId || generated.length === 0) return;
    try {
      // 使用 v2 API 批量保存题目到数据库
      const formattedChallenges = generated.map((ch, idx) => ({
        id: ch.id || `challenge-${Date.now()}-${idx}`,
        type: ch.type,
        question: ch.question,
        correct_answer: ch.correctAnswer,
        options: ch.options,
        explanation: ch.explanation,
        image_url: ch.imageUrl
      }));
      await userBankApi.createChallengesBatch(selectedSectionId, formattedChallenges);

      // Save to Knowledge Base
      if (inputSource === 'new' && saveToKb && !duplicateItem) {
        const newItem: KnowledgeItem = {
          id: `kb-${Date.now()}`,
          title: contentTitle || (inputMode === 'text' ? textContent.slice(0, 15) + '...' : '上传图片'),
          content: inputMode === 'text' ? textContent : 'Image Content',
          type: inputMode,
          createdAt: Date.now(),
          imageData: imagePreview || undefined
        };
        setKnowledgeBase(prev => [newItem, ...prev]);
      }

      setGenerated([]);
      if (inputSource === 'new') {
        setTextContent('');
        setImageFile(null);
        setImagePreview(null);
        setContentTitle('');
      }
      alert(`✅ ${formattedChallenges.length} 道题目已成功保存到数据库！`);
    } catch (error) {
      console.error('Failed to save challenges:', error);
      alert(`保存失败: ${error.message}`);
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-8">
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg mb-4 text-gray-700">1. 内容来源</h3>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputSource('new')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-bold transition-all ${inputSource === 'new' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500'}`}
            >
              上传新内容
            </button>
            <button
              onClick={() => setInputSource('library')}
              className={`flex-1 p-3 rounded-xl border-2 text-sm font-bold transition-all ${inputSource === 'library' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-gray-200 text-gray-500'}`}
            >
              从知识库选择
            </button>
          </div>

          {inputSource === 'library' ? (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-500">选择已有知识点:</label>
              <select
                className="w-full p-3 border-2 border-gray-200 rounded-xl bg-white text-gray-900"
                value={selectedLibraryId}
                onChange={(e) => setSelectedLibraryId(e.target.value)}
              >
                <option value="">-- 请选择 --</option>
                {knowledgeBase.map(kb => (
                  <option key={kb.id} value={kb.id}>{kb.title}</option>
                ))}
              </select>
              {selectedLibraryId && (
                <div className="bg-purple-50 p-3 rounded-xl text-xs text-purple-700 border border-purple-200">
                  已选中: {knowledgeBase.find(k => k.id === selectedLibraryId)?.title}
                  <br/>
                  <span className="opacity-70">系统将基于此内容生成新题目。</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
                <button
                  onClick={() => setInputMode('text')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${inputMode === 'text' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  <FileText size={16} /> 文本
                </button>
                <button
                  onClick={() => setInputMode('image')}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2 ${inputMode === 'image' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}
                >
                  <ImageIcon size={16} /> 图片
                </button>
              </div>

              <input
                type="text"
                className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400"
                placeholder="给这部分内容起个标题 (可选)"
                value={contentTitle}
                onChange={(e) => setContentTitle(e.target.value)}
              />

              {inputMode === 'text' ? (
                <div className="relative">
                  <textarea
                    className={`w-full h-48 p-4 border-2 rounded-xl resize-none focus:outline-none transition-colors text-gray-900 placeholder-gray-400 ${duplicateItem ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white focus:border-blue-500'}`}
                    placeholder="在此粘贴知识点..."
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                  {duplicateItem && (
                    <div className="absolute bottom-4 left-4 right-4 bg-white/90 p-2 rounded-lg border border-orange-200 text-orange-600 text-xs flex items-center gap-2 shadow-sm">
                      <AlertTriangle size={14} />
                      <span>检测到相似内容: "{duplicateItem.title}"。建议直接使用知识库。</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 relative overflow-hidden group">
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 bg-white/80 p-2 rounded-full hover:bg-red-100 hover:text-red-500 transition"
                      >
                        <Trash2 size={20} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload className="text-gray-400 mb-2" size={32} />
                      <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saveKb"
                  checked={saveToKb}
                  onChange={(e) => setSaveToKb(e.target.checked)}
                  disabled={!!duplicateItem}
                  className="w-4 h-4 rounded text-blue-600"
                />
                <label htmlFor="saveKb" className={`text-sm font-bold ${duplicateItem ? 'text-gray-400 decoration-line-through' : 'text-gray-600'}`}>同时保存至知识库</label>
              </div>

              {inputMode === 'text' && (
                <div className="mt-2 flex items-center gap-2">
                  <input type="checkbox" id="smart" checked={useSmartStructure} onChange={(e) => setUseSmartStructure(e.target.checked)} className="w-4 h-4 rounded text-indigo-600" />
                  <label htmlFor="smart" className="text-sm font-bold text-gray-600">智能结构化生成</label>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={isGenerating || (inputSource === 'new' && !textContent && !imageFile) || (inputSource === 'library' && !selectedLibraryId)}
                className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-extrabold py-3 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {isGenerating ? 'AI 处理中...' : (useSmartStructure && inputMode === 'text' ? '一键生成课程结构' : '生成题目')}
              </button>
              {taskSubmitted && !isGenerating && (
                <div className="mt-3 text-xs bg-blue-50 text-blue-700 px-3 py-2 rounded-xl border border-blue-200">
                  {loadingStep || '任务已提交，稍后可在右侧任务窗口查看进度与结果。'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm">
          <h3 className="font-bold text-lg text-gray-700 mb-4">2. 选择保存位置</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select
              className="p-2 border-2 border-gray-200 rounded-xl text-sm"
              value={selectedBankId}
              onChange={(e) => handleBankChange(e.target.value)}
            >
              {banks.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
            </select>
            <select
              className="p-2 border-2 border-gray-200 rounded-xl text-sm"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
            >
              {sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex-1">
          <h3 className="font-bold text-lg mb-4 text-gray-700 flex justify-between items-center">
            <span>3. 生成结果预览</span>
            {generated.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{generated.length} 题待保存</span>}
          </h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {!isGenerating && generated.length === 0 && (
              <div className="text-center text-gray-400 mt-20">
                <Sparkles className="mx-auto mb-2 opacity-20" size={64} />
                <p>等待生成...</p>
              </div>
            )}
            {generated.map((q, idx) => (
              <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="text-[10px] font-bold px-2 py-0.5 rounded uppercase bg-blue-100 text-blue-600 inline-block mb-2">{q.type}</div>
                <p className="font-bold text-gray-800 text-sm mb-3">{q.question}</p>
                {q.options && (
                  <div className="space-y-1 mb-3">
                    {q.options.map((opt: any) => (
                      <div key={opt.id} className={`text-xs p-2 rounded border ${opt.id === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-gray-100 text-gray-500'}`}>
                        {opt.id}. {opt.text}
                      </div>
                    ))}
                  </div>
                )}
                {q.type !== 'MULTIPLE_CHOICE' && (
                  <div className="text-xs text-green-600 font-bold mb-2">答案: {q.correctAnswer}</div>
                )}
                <div className="text-xs text-gray-400 border-t border-gray-200 pt-2">💡 {q.explanation}</div>
              </div>
            ))}
          </div>
          {generated.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <button
                onClick={handleSaveToSection}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold"
              >
                保存到选定章节
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

