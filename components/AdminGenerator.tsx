
import React, { useState, useMemo, useEffect } from 'react';
import { Sparkles, Loader2, FileText, Image as ImageIcon, Trash2, Upload, AlertTriangle, List, PlusCircle, X, Save, Layers, CheckCircle2 } from 'lucide-react';
import { Unit, Challenge, QuestionType, KnowledgeItem } from '../types';
import { fileToGenerativePart, generateQuizQuestions, generateStructuredCourseContent, checkDuplicate, fileToBase64, StructuredUnit, getAIConfig } from '../api';
import { apiClient, apiClientV2 } from '../apiClient';

interface AdminGeneratorProps {
    units: Unit[];
    setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
    knowledgeBase: KnowledgeItem[];
    setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
    onKnowledgeBaseAction?: (action: 'add' | 'delete' | 'set', item?: KnowledgeItem) => void;
    initialLibraryId?: string;
    onResetLibrarySelection: () => void;
    userId?: string; // 新增：用户ID，用于后台任务
    onTaskCreated?: (taskId: string, type: 'questions' | 'structure') => void; // 新增：任务创建回调
}

export default function AdminGenerator({ units, setUnits, knowledgeBase, setKnowledgeBase, onKnowledgeBaseAction, initialLibraryId, onResetLibrarySelection, userId, onTaskCreated }: AdminGeneratorProps) {
    // -- Input State --
    const [inputSource, setInputSource] = useState<'new' | 'library'>('new');
    const [selectedLibraryId, setSelectedLibraryId] = useState<string>('');
    const [inputMode, setInputMode] = useState<'text' | 'image'>('text');
    const [textContent, setTextContent] = useState('');
    const [contentTitle, setContentTitle] = useState(''); 
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [saveToKb, setSaveToKb] = useState(true);

    // -- Smart Structure Mode --
    const [useSmartStructure, setUseSmartStructure] = useState(false);

    // -- Processing State --
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingStep, setLoadingStep] = useState<string>(''); // Detailed loading text
    const [generatedChallenges, setGeneratedChallenges] = useState<Challenge[]>([]);
    const [taskSubmitted, setTaskSubmitted] = useState(false); // 新增：任务已提交标记

    // -- Target State --
    const [selectedUnitId, setSelectedUnitId] = useState(units[0]?.id || '');
    const [newLessonTitle, setNewLessonTitle] = useState('');
    const [showBatchCreate, setShowBatchCreate] = useState(false);
    const [batchInput, setBatchInput] = useState('');

    // Handle initial library selection from props
    useEffect(() => {
        if (initialLibraryId) {
            setInputSource('library');
            setSelectedLibraryId(initialLibraryId);
        }
    }, [initialLibraryId]);

    // Cleanup when switching away from library
    useEffect(() => {
        if (inputSource === 'new') {
            onResetLibrarySelection();
        }
    }, [inputSource, onResetLibrarySelection]);

    const duplicateItem = useMemo(() => {
        if (inputSource === 'new' && inputMode === 'text') {
            return checkDuplicate(textContent, knowledgeBase);
        }
        return null;
    }, [textContent, knowledgeBase, inputSource, inputMode]);

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          setImageFile(file);
          setImagePreview(URL.createObjectURL(file));
          setContentTitle(file.name.split('.')[0]);
        }
    };

    const handleGenerate = async () => {
        // Validate Inputs
        let finalPromptText = '';
        let finalImagePart = null;
    
        if (inputSource === 'library') {
            const item = knowledgeBase.find(k => k.id === selectedLibraryId);
            if (!item) return;
            finalPromptText = item.content; // Use raw content for structure analysis
        } else {
            if ((inputMode === 'text' && !textContent.trim()) || (inputMode === 'image' && !imageFile)) {
                alert('请提供内容');
                return;
            }
            finalPromptText = textContent;
            if (inputMode === 'image' && imageFile) {
                finalImagePart = await fileToGenerativePart(imageFile);
            }
        }
    
        // 获取AI配置
        const aiConfig = await getAIConfig(userId);
        
        // 检查是否可以使用后台任务模式（有userId且不是图片模式）
        const canUseBackgroundTask = userId && !finalImagePart;

        if (canUseBackgroundTask) {
            // === 后台任务模式 ===
            setIsGenerating(true);
            setLoadingStep('正在提交任务到后台...');
            setTaskSubmitted(false);

            try {
                if (useSmartStructure && inputMode === 'text') {
                    // 结构化生成任务
                    const { taskId } = await apiClient.createGenerateStructureTask(
                        userId,
                        finalPromptText,
                        aiConfig.systemPromptStructure || '',
                        aiConfig,
                        contentTitle || '智能结构化生成'
                    );
                    
                    setTaskSubmitted(true);
                    setLoadingStep('任务已提交！AI 正在后台处理，完成后会自动通知您。');
                    
                    // 通知父组件任务已创建
                    if (onTaskCreated) {
                        onTaskCreated(taskId, 'structure');
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
                        if (onKnowledgeBaseAction) {
                            onKnowledgeBaseAction('add', newItem);
                        } else {
                            setKnowledgeBase(prev => [newItem, ...prev]);
                        }
                    }

                    // 清空输入
                    setTimeout(() => {
                        setIsGenerating(false);
                        setLoadingStep('');
                        setTextContent('');
                        setContentTitle('');
                    }, 2000);

                } else {
                    // 题目生成任务
                    const promptPrefix = '请根据以下内容生成题目:\n';
                    const { taskId } = await apiClient.createGenerateQuestionsTask(
                        userId,
                        `${promptPrefix}${finalPromptText}`,
                        aiConfig.systemPromptText || '',
                        aiConfig,
                        contentTitle || '生成题目'
                    );
                    
                    setTaskSubmitted(true);
                    setLoadingStep('任务已提交！AI 正在后台处理，完成后会自动通知您。');
                    
                    // 通知父组件任务已创建
                    if (onTaskCreated) {
                        onTaskCreated(taskId, 'questions');
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
                        if (onKnowledgeBaseAction) {
                            onKnowledgeBaseAction('add', newItem);
                        } else {
                            setKnowledgeBase(prev => [newItem, ...prev]);
                        }
                    }

                    // 清空输入
                    setTimeout(() => {
                        setIsGenerating(false);
                        setLoadingStep('');
                        setTextContent('');
                        setContentTitle('');
                    }, 2000);
                }
            } catch (error: any) {
                console.error(error);
                const msg = error.message || '提交任务失败，请重试。';
                alert(`错误: ${msg}`);
                setIsGenerating(false);
                setLoadingStep('');
            }

        } else {
            // === 前端直接执行模式 (图片模式或无userId时的降级方案) ===
            setIsGenerating(true);
            setLoadingStep('正在连接 AI 大脑...');
            setGeneratedChallenges([]);
            setTaskSubmitted(false);
        
            try {
                if (useSmartStructure && inputMode === 'text') {
                    // --- Smart Structure Path (前端执行) ---
                    setLoadingStep('AI 正在分析文本结构 (识别章节和小节)...');
                    
                    const structuredUnits: StructuredUnit[] = await generateStructuredCourseContent(finalPromptText, userId);
                    
                    if (!structuredUnits || structuredUnits.length === 0) {
                        throw new Error("AI 返回了空结果，请检查内容是否足够丰富或重试。");
                    }

                    setLoadingStep(`识别成功！正在创建 ${structuredUnits.length} 个章节...`);

                    // Convert structured response to App Units
                    const colors = ['green', 'blue', 'purple', 'orange', 'rose', 'teal', 'yellow', 'indigo'];
                    const timestamp = Date.now();

                    const newUnits: Unit[] = structuredUnits.map((su, uIdx) => ({
                        id: `auto-unit-${timestamp}-${uIdx}`,
                        title: su.title,
                        description: su.description || 'AI 自动生成',
                        color: colors[uIdx % colors.length],
                        lessons: su.lessons.map((sl, lIdx) => ({
                            id: `auto-lesson-${timestamp}-${uIdx}-${lIdx}`,
                            title: sl.title,
                            completed: false,
                            locked: false,
                            stars: 0,
                            challenges: sl.challenges.map((ch, cIdx) => ({
                                ...ch,
                                id: `auto-ch-${timestamp}-${uIdx}-${lIdx}-${cIdx}`
                            }))
                        }))
                    }));

                    // Append to Units
                    setUnits(prev => [...prev, ...newUnits]);
                    setLoadingStep('完成！');
                    alert(`结构化导入成功！已自动创建 ${newUnits.length} 个章节和对应的小节与题目。`);

                } else {
                    // --- Traditional Question Generation Path ---
                    setLoadingStep('AI 正在根据内容编写题目...');
                    
                    const promptPrefix = inputMode === 'text' 
                        ? `请根据以下内容生成题目:\n` 
                        : `请分析这张图片中的医学知识点，并生成题目。`;
                    
                    const questions = await generateQuizQuestions(
                        inputMode === 'text' ? `${promptPrefix}${finalPromptText}` : promptPrefix, 
                        finalImagePart,
                        userId
                    );
                    
                    setGeneratedChallenges(questions);
                    if (questions.length === 0) {
                        throw new Error("未能生成题目，请重试");
                    }
                }
            } catch (error: any) {
                console.error(error);
                const msg = error.message || '生成失败，请重试。可能内容过长或网络超时。';
                alert(`错误: ${msg}`);
            } finally {
                setIsGenerating(false);
                setLoadingStep('');
            }
        }
    };

    const handleAddLesson = () => {
        if (!newLessonTitle || !selectedUnitId) return;
        setUnits(prev => prev.map(u => {
          if (u.id === selectedUnitId) {
            return {
              ...u,
              lessons: [...u.lessons, {
                id: `lesson-${Date.now()}`,
                title: newLessonTitle,
                completed: false,
                locked: false, 
                stars: 0,
                challenges: []
              }]
            };
          }
          return u;
        }));
        setNewLessonTitle('');
    };

    const handleBatchCreateUnits = () => {
        if (!batchInput.trim()) return;
        const lines = batchInput.split('\n').filter(l => l.trim());
        const colors = ['green', 'blue', 'purple', 'orange', 'rose', 'teal', 'yellow', 'indigo'];
        
        const newUnits: Unit[] = lines.map((line, idx) => ({
            id: `unit-batch-${Date.now()}-${idx}`,
            title: line.trim(),
            description: '点击进入章节学习',
            color: colors[idx % colors.length],
            lessons: [{
                id: `lesson-batch-${Date.now()}-${idx}-1`,
                title: '第1节',
                completed: false,
                locked: false,
                stars: 0,
                challenges: []
            }]
        }));
  
        setUnits(prev => [...prev, ...newUnits]);
        setBatchInput('');
        setShowBatchCreate(false);
        alert(`成功创建了 ${newUnits.length} 个新章节！`);
    };

    const saveToLesson = async (lessonId: string) => {
        if (generatedChallenges.length === 0) return;
        
        try {
            // 使用 v2 API 批量保存题目到数据库
            const formattedChallenges = generatedChallenges.map((ch, idx) => ({
                id: ch.id || `challenge-${Date.now()}-${idx}`,
                type: ch.type,
                question: ch.question,
                correct_answer: ch.correctAnswer,
                options: ch.options,
                explanation: ch.explanation,
                image_url: ch.imageUrl
            }));

            await apiClientV2.createChallengesBatch(lessonId, formattedChallenges);
    
            // Save to Knowledge Base using the new handler
            if (inputSource === 'new' && saveToKb && !duplicateItem) {
                const newItem: KnowledgeItem = {
                    id: `kb-${Date.now()}`,
                    title: contentTitle || (inputMode === 'text' ? textContent.slice(0, 15) + '...' : '上传图片'),
                    content: inputMode === 'text' ? textContent : 'Image Content',
                    type: inputMode,
                    createdAt: Date.now(),
                    imageData: imagePreview || undefined
                };
                
                // Use the prop callback if available (DB sync), otherwise fallback to local set
                if (onKnowledgeBaseAction) {
                    onKnowledgeBaseAction('add', newItem);
                } else {
                    setKnowledgeBase(prev => [newItem, ...prev]);
                }
            }
        
            setGeneratedChallenges([]);
            if (inputSource === 'new') {
                setTextContent('');
                setImageFile(null);
                setImagePreview(null);
                setContentTitle('');
            }
            alert(`✅ ${formattedChallenges.length} 道题目已成功保存到数据库！`);
        } catch (error: any) {
            console.error('Failed to save challenges:', error);
            alert(`保存失败: ${error.message}`);
        }
    };

    return (
        <div className="grid lg:grid-cols-12 gap-8 relative">
            
            {/* --- Loading Overlay --- */}
            {isGenerating && (
                <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center animate-in fade-in duration-300">
                    <div className="relative">
                        {taskSubmitted ? (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <CheckCircle2 size={64} className="text-green-600 relative z-10" />
                            </>
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                                <Loader2 size={64} className="text-blue-600 animate-spin relative z-10" />
                            </>
                        )}
                    </div>
                    <h3 className={`mt-6 text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r ${taskSubmitted ? 'from-green-600 to-emerald-600' : 'from-blue-600 to-purple-600'}`}>
                        {taskSubmitted ? '任务已提交' : 'AI 正在工作中'}
                    </h3>
                    <p className="mt-2 text-gray-500 font-medium animate-pulse">{loadingStep}</p>
                    {taskSubmitted && (
                        <p className="mt-4 text-sm text-gray-400">
                            您可以在左侧「任务管理器」中查看进度
                        </p>
                    )}
                </div>
            )}

            {/* Left Col: Source Configuration */}
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
                                        <div className="absolute bottom-4 left-4 right-4 bg-white/90 p-2 rounded-lg border border-orange-200 text-orange-600 text-xs flex items-center gap-2 shadow-sm animate-in fade-in slide-in-from-bottom-2">
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
                                <label htmlFor="saveKb" className={`text-sm font-bold ${duplicateItem ? 'text-gray-400 decoration-line-through' : 'text-gray-600'}`}>
                                    同时保存至知识库 (方便日后复用)
                                </label>
                            </div>
                        </div>
                    )}

                    {/* Mode Toggle for Smart Structure */}
                    {inputMode === 'text' && (
                        <div className={`mt-4 p-3 rounded-xl border-2 flex items-center gap-3 transition-colors ${useSmartStructure ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
                            <div className={`p-2 rounded-full ${useSmartStructure ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                                <Layers size={20} />
                            </div>
                            <div className="flex-1">
                                <label htmlFor="smartMode" className={`block text-sm font-bold cursor-pointer ${useSmartStructure ? 'text-indigo-700' : 'text-gray-500'}`}>
                                    智能结构化生成 (Beta)
                                </label>
                                <p className="text-xs text-gray-400">
                                    自动分析长文本，一次性生成章节、小节和题目。
                                </p>
                            </div>
                            <input 
                                type="checkbox" 
                                id="smartMode"
                                checked={useSmartStructure}
                                onChange={(e) => setUseSmartStructure(e.target.checked)}
                                className="w-5 h-5 rounded text-indigo-600"
                            />
                        </div>
                    )}

                    <button 
                        onClick={handleGenerate}
                        disabled={isGenerating || (inputSource === 'new' && !textContent && !imageFile) || (inputSource === 'library' && !selectedLibraryId)}
                        className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-extrabold py-4 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />} 
                        {isGenerating ? 'AI 处理中...' : (useSmartStructure && inputMode === 'text' ? '一键生成课程结构' : '生成题目')}
                    </button>
                </div>
            </div>

            {/* Right Col: Preview & Target */}
            <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Target Unit Selector & Batch Create */}
                <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm relative">
                    {useSmartStructure && inputMode === 'text' && (
                         <div className="absolute inset-0 bg-gray-50/80 backdrop-blur-[1px] z-10 rounded-2xl flex items-center justify-center">
                             <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 flex items-center gap-3 text-gray-500 font-bold">
                                 <Layers className="text-indigo-500" />
                                 结构化模式下无需选择目标课程，系统将自动创建。
                             </div>
                         </div>
                    )}
                    
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-700">2. 选择目标课程</h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setShowBatchCreate(!showBatchCreate)}
                                className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-lg hover:bg-gray-200 font-bold flex items-center gap-1"
                            >
                                <List size={14} /> {showBatchCreate ? '取消批量' : '批量新建章节'}
                            </button>
                        </div>
                    </div>
                    
                    {showBatchCreate ? (
                        <div className="animate-fade-in space-y-3 bg-gray-50 p-4 rounded-xl border border-dashed border-gray-300">
                            <label className="block text-xs font-bold text-gray-500">粘贴章节目录 (一行一个，例如：第十二章 动物伦理):</label>
                            <textarea 
                                className="w-full h-32 p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                placeholder="第一章..."
                                value={batchInput}
                                onChange={(e) => setBatchInput(e.target.value)}
                            />
                            <button 
                                onClick={handleBatchCreateUnits}
                                disabled={!batchInput.trim()}
                                className="w-full bg-black text-white py-2 rounded-lg text-sm font-bold hover:bg-gray-800 disabled:opacity-50"
                            >
                                确认创建
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <input 
                                    type="text" 
                                    className="flex-1 p-2 border-2 border-gray-200 rounded-lg text-xs bg-white text-gray-900" 
                                    placeholder="新小节名称 (如: 1.1 概念)" 
                                    value={newLessonTitle}
                                    onChange={(e) => setNewLessonTitle(e.target.value)}
                                />
                                <button onClick={handleAddLesson} className="bg-green-100 text-green-600 px-3 py-1 rounded-lg hover:bg-green-200 font-bold text-xs"><PlusCircle size={16}/></button>
                            </div>
                            <select 
                                className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm font-medium bg-white text-gray-900"
                                value={selectedUnitId}
                                onChange={(e) => setSelectedUnitId(e.target.value)}
                            >
                                {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Preview Area */}
                <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm flex-1 flex flex-col min-h-[400px]">
                    <h3 className="font-bold text-lg mb-4 text-gray-700 flex justify-between items-center">
                        <span>3. 生成结果预览</span>
                        {generatedChallenges.length > 0 && <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{generatedChallenges.length} 题待保存</span>}
                    </h3>
                    
                    <div className="flex-1 overflow-y-auto space-y-4 pr-2 max-h-[500px]">
                        {generatedChallenges.length === 0 && !isGenerating && (
                            <div className="text-center text-gray-400 mt-20">
                                <Sparkles className="mx-auto mb-2 opacity-20" size={64} />
                                <p>{useSmartStructure ? '结构化生成的内容将直接保存到课程列表，不在此预览。' : '等待生成...'}</p>
                            </div>
                        )}
                        
                        {generatedChallenges.map((q, idx) => (
                            <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 relative group">
                                <button 
                                    onClick={() => setGeneratedChallenges(prev => prev.filter((_, i) => i !== idx))}
                                    className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 size={16} />
                                </button>
                                <div className="flex gap-2 mb-2">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                        q.type === 'MULTIPLE_CHOICE' ? 'bg-purple-100 text-purple-600' : 
                                        q.type === 'TRUE_FALSE' ? 'bg-orange-100 text-orange-600' : 
                                        q.type === 'SINGLE_CHOICE' ? 'bg-blue-100 text-blue-600' :
                                        q.type === 'FILL_BLANK' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                                    }`}>{q.type}</span>
                                </div>
                                <p className="font-bold text-gray-800 text-sm mb-3">{q.question}</p>
                                
                                {q.options && (
                                    <div className="space-y-1 mb-3">
                                        {q.options.map(opt => (
                                            <div key={opt.id} className={`text-xs p-2 rounded border ${opt.id === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-700 font-bold' : 'bg-white border-gray-100 text-gray-500'}`}>
                                                {opt.id}. {opt.text}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {q.type !== 'MULTIPLE_CHOICE' && (
                                    <div className="text-xs text-green-600 font-bold mb-2">答案: {q.correctAnswer}</div>
                                )}

                                <div className="text-xs text-gray-400 border-t border-gray-200 pt-2">
                                    💡 {q.explanation}
                                </div>
                            </div>
                        ))}
                    </div>

                    {generatedChallenges.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                            <label className="block text-sm font-bold text-gray-500 mb-2">选择要保存到的课程:</label>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {units.find(u => u.id === selectedUnitId)?.lessons.map(l => (
                                    <button 
                                        key={l.id}
                                        onClick={() => saveToLesson(l.id)}
                                        className="bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-colors"
                                    >
                                        + 存入: {l.title}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
