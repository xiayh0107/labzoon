
import React, { useState, useEffect, useRef } from 'react';
import { Loader2, CheckSquare, Square, Trash2, Edit3, Save, Image as ImageIcon, X, Clock, Terminal, AlertCircle, AlertTriangle } from 'lucide-react';
import { Unit, Challenge, QuestionType } from '../types';
import { generateImageForText, fileToBase64, generateOptionsForQuestion } from '../api';
import { apiClientV2 } from '../apiClient';

interface AdminQuestionBankProps {
    units: Unit[];
    setUnits: React.Dispatch<React.SetStateAction<Unit[]>>;
    userId?: string;
}

export default function AdminQuestionBank({ units, setUnits, userId }: AdminQuestionBankProps) {
    const [qbUnitId, setQbUnitId] = useState(units[0]?.id || '');
    const [qbLessonId, setQbLessonId] = useState('');
    const [editingChallenge, setEditingChallenge] = useState<Partial<Challenge> | null>(null);
    const [selectedQIds, setSelectedQIds] = useState<Set<string>>(new Set());
    
    // Dynamic loading state
    const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
    const [loadedLessons, setLoadedLessons] = useState<Set<string>>(new Set());
    
    // UI State for generation
    const [isImageGenLoading, setIsImageGenLoading] = useState(false);
    const [isOptionGenLoading, setIsOptionGenLoading] = useState(false);
    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const [generatingQId, setGeneratingQId] = useState<string | null>(null);
    
    // Logging State
    const [batchLogs, setBatchLogs] = useState<string[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Custom Modal & Toast State (To replace native confirm/alert)
    const [modal, setModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const currentUnit = units.find(u => u.id === qbUnitId);
    const currentLesson = currentUnit?.lessons.find(l => l.id === qbLessonId);

    // Dynamic load challenges when lesson is selected
    useEffect(() => {
        if (!qbLessonId || !qbUnitId) return;
        
        const cacheKey = `${qbUnitId}:${qbLessonId}`;
        // Skip if already loaded
        if (loadedLessons.has(cacheKey)) return;
        
        // Check if lesson already has challenges loaded
        const lesson = units.find(u => u.id === qbUnitId)?.lessons.find(l => l.id === qbLessonId);
        if (lesson && lesson.challenges && lesson.challenges.length > 0) {
            setLoadedLessons(prev => new Set(prev).add(cacheKey));
            return;
        }
        
        // Fetch challenges using v2 API
        const loadChallenges = async () => {
            setIsLoadingChallenges(true);
            try {
                const challenges = await apiClientV2.fetchChallenges(qbLessonId);
                if (challenges && challenges.length > 0) {
                    // Convert v2 format to v1 format with smart type detection
                    const convertedChallenges: Challenge[] = challenges.map(c => {
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
                        
                        return {
                            id: c.id,
                            type: normalizedType as QuestionType,
                            question: c.question,
                            correctAnswer: normalizedAnswer,
                            options: c.options,
                            explanation: c.explanation,
                            imageUrl: c.image_url
                        };
                    });
                    // Update units with loaded challenges
                    setUnits(prev => prev.map(u => {
                        if (u.id !== qbUnitId) return u;
                        return {
                            ...u,
                            lessons: u.lessons.map(l => {
                                if (l.id !== qbLessonId) return l;
                                return { ...l, challenges: convertedChallenges };
                            })
                        };
                    }));
                    setLoadedLessons(prev => new Set(prev).add(cacheKey));
                }
            } catch (error) {
                console.error('Failed to load challenges:', error);
                showToast('加载题目失败', 'error');
            } finally {
                setIsLoadingChallenges(false);
            }
        };
        
        loadChallenges();
    }, [qbUnitId, qbLessonId]);

    // Auto-scroll logs
    useEffect(() => {
        if (batchLogs.length > 0) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [batchLogs]);

    // Auto-dismiss toast
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const addLog = (msg: string) => {
        setBatchLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ message, type });
        if (type === 'error') addLog(`❌ ${message}`);
    };

    // --- Deletion Handlers ---

    const handleDeleteUnit = () => {
        if (!currentUnit) return;
        setModal({
            title: '删除章节',
            message: `确定要删除章节 "${currentUnit.title}" 吗？该操作将删除该章节下的所有小节和题目，且不可恢复。`,
            onConfirm: () => {
                setUnits(prev => prev.filter(u => u.id !== qbUnitId));
                setQbUnitId(units.find(u => u.id !== qbUnitId)?.id || '');
                setQbLessonId('');
                setModal(null);
                showToast('章节已删除', 'success');
            }
        });
    };

    const handleDeleteLesson = () => {
        if (!currentLesson || !currentUnit) return;
        setModal({
            title: '删除小节',
            message: `确定要删除小节 "${currentLesson.title}" 吗？该操作将删除该小节下的所有题目，且不可恢复。`,
            onConfirm: () => {
                setUnits(prev => prev.map(u => {
                    if (u.id !== qbUnitId) return u;
                    return {
                        ...u,
                        lessons: u.lessons.filter(l => l.id !== qbLessonId)
                    };
                }));
                setQbLessonId('');
                setModal(null);
                showToast('小节已删除', 'success');
            }
        });
    };

    const handleNewChallenge = () => {
        setEditingChallenge({
            id: `custom-${Date.now()}`,
            type: QuestionType.SINGLE_CHOICE,
            question: '请输入题目...',
            options: [
                { id: 'A', text: '选项 A' },
                { id: 'B', text: '选项 B' }
            ],
            correctAnswer: 'B',
            explanation: '在此输入解析...'
        });
    };

    const handleEditChallenge = (challenge: Challenge) => {
        setEditingChallenge({ ...challenge });
    };

    const handleSaveChallenge = async () => {
        if (!editingChallenge || !editingChallenge.question || !qbLessonId) {
            showToast('请填写完整题目信息', 'error');
            return;
        }
        
        const isNew = !currentLesson?.challenges.find(c => c.id === editingChallenge.id);
        
        try {
            // Save to database using v2 API
            if (isNew) {
                // Create new challenge
                await apiClientV2.createChallengesBatch(qbLessonId, [{
                    id: editingChallenge.id || `challenge-${Date.now()}`,
                    type: editingChallenge.type || QuestionType.SINGLE_CHOICE,
                    question: editingChallenge.question,
                    correct_answer: editingChallenge.correctAnswer || '',
                    options: editingChallenge.options || [],
                    explanation: editingChallenge.explanation || '',
                    image_url: editingChallenge.imageUrl || ''
                }]);
            } else {
                // Update existing challenge
                await apiClientV2.updateChallenge(editingChallenge.id!, {
                    type: editingChallenge.type,
                    question: editingChallenge.question,
                    correct_answer: editingChallenge.correctAnswer,
                    options: editingChallenge.options,
                    explanation: editingChallenge.explanation,
                    image_url: editingChallenge.imageUrl
                });
            }
            
            // Update local state
            setUnits(prev => prev.map(u => {
                if (u.id !== qbUnitId) return u;
                return {
                    ...u,
                    lessons: u.lessons.map(l => {
                        if (l.id !== qbLessonId) return l;
                        const exists = l.challenges.find(c => c.id === editingChallenge.id);
                        if (exists) {
                            return {
                                ...l,
                                challenges: l.challenges.map(c => c.id === editingChallenge.id ? (editingChallenge as Challenge) : c)
                            };
                        } else {
                            return {
                                ...l,
                                challenges: [...l.challenges, (editingChallenge as Challenge)]
                            };
                        }
                    })
                };
            }));
            // Keep showing the saved challenge instead of clearing
            // setEditingChallenge(null);
            showToast('题目保存成功', 'success');
        } catch (error) {
            console.error('Failed to save challenge:', error);
            showToast('保存失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
        }
    };

    const handleDeleteChallenge = (challengeId: string) => {
        setModal({
            title: '删除确认',
            message: '确定要永久删除这道题目吗？',
            onConfirm: async () => {
                try {
                    // Delete from database using v2 API
                    await apiClientV2.deleteChallenge(challengeId);
                    
                    // Update local state
                    setUnits(prev => prev.map(u => {
                        if(u.id !== qbUnitId) return u;
                        return {
                            ...u,
                            lessons: u.lessons.map(l => {
                                if(l.id !== qbLessonId) return l;
                                return {
                                    ...l,
                                    challenges: l.challenges.filter(c => c.id !== challengeId)
                                };
                            })
                        };
                    }));
                    if (editingChallenge?.id === challengeId) setEditingChallenge(null);
                    const newSet = new Set(selectedQIds);
                    newSet.delete(challengeId);
                    setSelectedQIds(newSet);
                    setModal(null);
                    showToast('题目已删除', 'success');
                } catch (error) {
                    console.error('Failed to delete challenge:', error);
                    showToast('删除失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
                    setModal(null);
                }
            }
        });
    };

    const handleToggleSelection = (id: string) => {
        const newSet = new Set(selectedQIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedQIds(newSet);
    };

    const handleChallengeImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editingChallenge) {
            const base64 = await fileToBase64(e.target.files[0]);
            setEditingChallenge({ ...editingChallenge, imageUrl: base64 });
        }
    };

    // Helper to get text for correct answer
    const getAnswerText = (challenge: Partial<Challenge>): string => {
        if (!challenge.correctAnswer) return '';
        if (challenge.type === QuestionType.FILL_BLANK) return challenge.correctAnswer;
        
        // For Multiple Choice (multi-select), handle comma-separated answers
        if (challenge.type === QuestionType.MULTIPLE_CHOICE) {
            const answerIds = challenge.correctAnswer.split(',');
            const answerTexts = answerIds.map(id => {
                const option = challenge.options?.find(o => o.id === id);
                return option ? option.text : id;
            });
            return answerTexts.join(', ');
        }
        
        // For Single Choice / True False, find the option text
        const option = challenge.options?.find(o => o.id === challenge.correctAnswer);
        return option ? option.text : challenge.correctAnswer;
    };

    // Ensure AI config is loaded per user
    const handleSingleGenImage = async () => {
        if (!editingChallenge || !editingChallenge.question) return;
        setIsImageGenLoading(true);
        try {
            const answerText = getAnswerText(editingChallenge);
            // Always pass userId for personalized config
            const img = await generateImageForText(editingChallenge.question, answerText, userId);
            if (img) {
                setEditingChallenge({ ...editingChallenge, imageUrl: img });
                showToast('配图生成成功', 'success');
            } else {
                showToast('配图生成失败，请重试', 'error');
            }
        } catch (e) {
            showToast('配图生成失败: ' + (e instanceof Error ? e.message : String(e)), 'error');
        }
        setIsImageGenLoading(false);
    };

    const handleGenerateOptions = async () => {
        if (!editingChallenge || !editingChallenge.question) return;
        setIsOptionGenLoading(true);
        try {
            // Always pass userId for personalized config
            const options = await generateOptionsForQuestion(editingChallenge.question, editingChallenge.type || QuestionType.SINGLE_CHOICE, userId);
            if (options && options.length > 0) {
                setEditingChallenge(prev => ({
                    ...prev!,
                    options: options,
                    correctAnswer: prev?.correctAnswer || options[0].id 
                }));
                showToast('选项生成成功', 'success');
            } else {
                showToast('生成失败，请重试', 'error');
            }
        } catch (e) {
            showToast('生成出错: ' + (e instanceof Error ? e.message : String(e)), 'error');
        } finally {
            setIsOptionGenLoading(false);
        }
    };

    // The Logic to execute batch generation
    const executeBatchGeneration = async () => {
        if (!currentLesson) return;
        const tasks = currentLesson.challenges.filter(c => selectedQIds.has(c.id));
        
        setIsBatchProcessing(true);
        setBatchLogs([]); 
        addLog(`开始任务：准备处理 ${tasks.length} 个题目`);
        setModal(null); // Close modal
        
        let successCount = 0;
        let failCount = 0;

        try {
            for (let i = 0; i < tasks.length; i++) {
                const task = tasks[i];
                setGeneratingQId(task.id);
                addLog(`[${i + 1}/${tasks.length}] 正在生成: "${task.question.slice(0, 10)}..."`);
      
                try {
                    // Extract answer context for batch items
                    const answerText = getAnswerText(task);
                    
                    const img = await generateImageForText(task.question, answerText, userId);
                    
                    if (img) {
                        successCount++;
                        addLog(`✅ 生成成功，保存中...`);
                        
                        // Use v2 API to save image directly to database
                        try {
                            await apiClientV2.updateChallenge(task.id, { image_url: img });
                            addLog(`💾 已保存到数据库`);
                        } catch (saveError) {
                            addLog(`⚠️ 保存失败，仅更新本地: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
                        }
                        
                        // Update local state (without triggering old API)
                        setUnits(prev => prev.map(u => {
                            if (u.id !== qbUnitId) return u;
                            return {
                                ...u,
                                lessons: u.lessons.map(l => {
                                    if (l.id !== qbLessonId) return l;
                                    return {
                                        ...l,
                                        challenges: l.challenges.map(c => 
                                            c.id === task.id ? { ...c, imageUrl: img } : c
                                        )
                                    };
                                })
                            };
                        }));
                    } else {
                        failCount++;
                        addLog(`❌ 生成失败: API 返回空数据`);
                    }
                } catch (error) {
                    failCount++;
                    addLog(`❌ 异常: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        } catch (e) {
            console.error("Batch processing error", e);
            addLog(`⛔ 严重错误: ${e instanceof Error ? e.message : String(e)}`);
        } finally {
            setGeneratingQId(null);
            setIsBatchProcessing(false);
            setSelectedQIds(new Set());
            addLog(`🏁 任务结束. 成功: ${successCount}, 失败: ${failCount}`);
            showToast(`批量处理完成! 成功 ${successCount} 个`, 'success');
        }
    };

    // Trigger for the button
    const handleBatchGenerateClick = () => {
        if (selectedQIds.size === 0) return;
        
        if (!currentLesson) {
            showToast("找不到当前章节信息，请刷新重试", 'error');
            return;
        }

        const tasks = currentLesson.challenges.filter(c => selectedQIds.has(c.id));
        
        if (tasks.length === 0) {
            showToast("选中的题目不存在或已被删除", 'error');
            return;
        }

        // Use Custom Modal instead of window.confirm
        setModal({
            title: '批量生成配图',
            message: `即将为 ${tasks.length} 个题目生成AI配图。这可能需要几分钟时间，且会消耗一定的API额度。确定要继续吗？`,
            onConfirm: executeBatchGeneration
        });
    };

    return (
        <div className="grid lg:grid-cols-12 gap-6 h-[calc(100vh-250px)] min-h-[500px] relative">
              {/* Custom Modal Overlay */}
              {modal && (
                  <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
                      <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
                          <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                              <AlertTriangle className="text-orange-500" />
                              {modal.title}
                          </h3>
                          <p className="text-gray-600 mb-6 text-sm leading-relaxed">{modal.message}</p>
                          <div className="flex gap-3 justify-end">
                              <button 
                                  onClick={() => setModal(null)}
                                  className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                              >
                                  取消
                              </button>
                              <button 
                                  onClick={modal.onConfirm}
                                  className="px-4 py-2 rounded-lg text-sm font-bold bg-black text-white hover:bg-gray-800 transition-colors shadow-lg"
                              >
                                  确认继续
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* Toast Notification */}
              {toast && (
                  <div className={`absolute top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-xl flex items-center gap-2 font-bold text-sm animate-in slide-in-from-top-4 fade-in duration-300 ${
                      toast.type === 'success' ? 'bg-green-500 text-white' : 
                      toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'
                  }`}>
                      {toast.type === 'success' ? <CheckSquare size={16} /> : <AlertCircle size={16} />}
                      {toast.message}
                  </div>
              )}

              {/* Left Column: Navigation & List */}
              <div className="lg:col-span-4 flex flex-col gap-4 bg-white p-4 rounded-2xl border-2 border-gray-200 shadow-sm overflow-hidden h-full">
                  <div className="flex flex-col gap-2 shrink-0">
                      <label className="text-xs font-bold text-gray-400 uppercase">1. 选择章节</label>
                      <div className="flex gap-2">
                        <select 
                            className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-orange-500 outline-none bg-white text-gray-900"
                            value={qbUnitId}
                            onChange={(e) => { setQbUnitId(e.target.value); setQbLessonId(''); setSelectedQIds(new Set()); setBatchLogs([]); }}
                        >
                            {units.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
                        </select>
                        <button 
                            onClick={handleDeleteUnit}
                            disabled={!qbUnitId}
                            className="px-2 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                            title="删除章节"
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 shrink-0">
                      <label className="text-xs font-bold text-gray-400 uppercase">2. 选择小节</label>
                      <div className="flex gap-2">
                        <select 
                            className="w-full p-2 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-orange-500 outline-none bg-white text-gray-900"
                            value={qbLessonId}
                            onChange={(e) => { setQbLessonId(e.target.value); setSelectedQIds(new Set()); setBatchLogs([]); }}
                        >
                            <option value="">-- 请选择小节 --</option>
                            {units.find(u => u.id === qbUnitId)?.lessons.map(l => (
                                <option key={l.id} value={l.id}>{l.title}</option>
                            ))}
                        </select>
                        <button 
                            onClick={handleDeleteLesson}
                            disabled={!qbLessonId}
                            className="px-2 bg-red-50 text-red-500 rounded-xl border border-red-100 hover:bg-red-100 transition-colors"
                            title="删除小节"
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>
                  </div>

                  {/* Batch Logs Display */}
                  {batchLogs.length > 0 && (
                      <div className="shrink-0 bg-gray-900 rounded-xl p-3 max-h-32 overflow-y-auto border border-gray-700 shadow-inner">
                          <div className="flex items-center gap-2 text-gray-400 text-xs font-bold mb-2 sticky top-0 bg-gray-900 pb-1 border-b border-gray-800">
                              <Terminal size={12} /> 处理日志
                          </div>
                          <div className="space-y-1 font-mono text-[10px]">
                              {batchLogs.map((log, i) => (
                                  <div key={i} className={`${log.includes('❌') || log.includes('⛔') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}`}>
                                      {log}
                                  </div>
                              ))}
                              <div ref={logsEndRef} />
                          </div>
                      </div>
                  )}

                  <div className="flex-1 overflow-y-auto mt-2 border-t pt-2 min-h-0">
                      <div className="flex justify-between items-center mb-2 shrink-0">
                          <label className="text-xs font-bold text-gray-400 uppercase">题目列表</label>
                          <div className="flex gap-2">
                            {selectedQIds.size > 0 && (
                                <button
                                    type="button"
                                    onClick={handleBatchGenerateClick}
                                    disabled={isBatchProcessing}
                                    className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-lg font-bold hover:bg-yellow-200 disabled:opacity-50 flex items-center gap-1 transition-colors shadow-sm"
                                >
                                    {isBatchProcessing ? <Loader2 size={12} className="animate-spin" /> : '🍌'} 批量({selectedQIds.size})
                                </button>
                            )}
                            <button 
                                onClick={handleNewChallenge}
                                disabled={!qbLessonId || isBatchProcessing}
                                className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-lg font-bold hover:bg-orange-200 disabled:opacity-50 shadow-sm"
                            >
                                + 新增
                            </button>
                          </div>
                      </div>
                      
                      <div className="space-y-2 pb-4">
                          {!qbLessonId ? (
                              <div className="text-center text-gray-400 py-10 text-sm">请先选择小节</div>
                          ) : isLoadingChallenges ? (
                              <div className="text-center py-10">
                                  <Loader2 size={24} className="animate-spin text-orange-500 mx-auto mb-2" />
                                  <div className="text-gray-400 text-sm">加载题目中...</div>
                              </div>
                          ) : currentLesson?.challenges.length === 0 ? (
                              <div className="text-center text-gray-400 py-10 text-sm">暂无题目</div>
                          ) : (
                              currentLesson?.challenges.map((c, idx) => (
                                  <div 
                                    key={c.id}
                                    onClick={() => !isBatchProcessing && handleEditChallenge(c)}
                                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex gap-2 items-start ${editingChallenge?.id === c.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-orange-200'} ${isBatchProcessing && generatingQId !== c.id ? 'opacity-50 pointer-events-none' : ''}`}
                                  >
                                      <div onClick={(e) => { e.stopPropagation(); if(!isBatchProcessing) handleToggleSelection(c.id); }} className="mt-1 cursor-pointer text-gray-400 hover:text-blue-500 pointer-events-auto">
                                          {selectedQIds.has(c.id) ? <CheckSquare size={16} className="text-blue-500"/> : <Square size={16} />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <div className="flex justify-between mb-1">
                                            <div className="flex gap-2 items-center">
                                                <span className="text-[10px] bg-gray-200 text-gray-600 px-1 rounded">{c.type}</span>
                                                {/* Progress Indicators */}
                                                {generatingQId === c.id && (
                                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse font-bold">
                                                        <Loader2 size={10} className="animate-spin"/> 生成中...
                                                    </span>
                                                )}
                                                {isBatchProcessing && selectedQIds.has(c.id) && generatingQId !== c.id && (
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                        <Clock size={10} /> 排队中
                                                    </span>
                                                )}
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteChallenge(c.id); }} 
                                                className="text-gray-400 hover:text-red-500"
                                                disabled={isBatchProcessing}
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                          </div>
                                          <p className="text-xs font-bold text-gray-700 line-clamp-2">{c.question}</p>
                                          {c.imageUrl && <span className="text-[10px] text-green-600 flex items-center gap-1 mt-1 font-bold">🍌 已配图</span>}
                                      </div>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>

              {/* Right Column: Editor */}
              <div className="lg:col-span-8 bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm overflow-y-auto h-full">
                  {!editingChallenge ? (
                      <div className="h-full flex flex-col items-center justify-center text-gray-400">
                          <Edit3 size={48} className="mb-4 opacity-20" />
                          <p>请在左侧选择题目或点击“新增”</p>
                          {isBatchProcessing && (
                              <div className="mt-4 p-4 bg-yellow-50 text-yellow-700 rounded-xl flex items-center gap-2 border border-yellow-100 animate-in fade-in slide-in-from-bottom-2">
                                  <Loader2 className="animate-spin" /> 正在批量处理中，请稍候...
                              </div>
                          )}
                      </div>
                  ) : (
                      <div className="space-y-6">
                          <div className="flex justify-between items-center border-b pb-4">
                              <h3 className="font-bold text-lg text-gray-800">题目编辑器</h3>
                              <div className="flex gap-2">
                                  <button onClick={() => setEditingChallenge(null)} className="px-4 py-2 rounded-lg font-bold text-sm text-gray-500 hover:bg-gray-100">取消</button>
                                  <button onClick={handleSaveChallenge} className="px-4 py-2 rounded-lg font-bold text-sm bg-orange-500 text-white hover:bg-orange-600 flex items-center gap-2"><Save size={16}/> 保存更改</button>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">题目类型</label>
                                  <select 
                                    className="w-full p-2 border-2 border-gray-200 rounded-lg text-sm bg-white text-gray-900"
                                    value={editingChallenge.type}
                                    onChange={(e) => setEditingChallenge({ ...editingChallenge, type: e.target.value as QuestionType })}
                                  >
                                      <option value="SINGLE_CHOICE">单项选择题</option>
                                      <option value="MULTIPLE_CHOICE">多项选择题（多选）</option>
                                      <option value="TRUE_FALSE">判断题</option>
                                      <option value="FILL_BLANK">填空题</option>
                                  </select>
                              </div>
                          </div>

                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">题干内容</label>
                              <textarea 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm focus:border-orange-500 outline-none bg-white text-gray-900 placeholder-gray-400"
                                rows={3}
                                value={editingChallenge.question}
                                onChange={(e) => setEditingChallenge({ ...editingChallenge, question: e.target.value })}
                              />
                          </div>

                          <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-gray-500">图片 (可选)</label>
                                <button 
                                    onClick={handleSingleGenImage}
                                    disabled={isImageGenLoading || !editingChallenge.question}
                                    className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full font-bold hover:bg-yellow-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                                >
                                    {isImageGenLoading ? <Loader2 size={12} className="animate-spin" /> : '🍌'} AI 生成配图
                                </button>
                              </div>
                              <div className="flex items-start gap-4">
                                  <div className="w-32 h-32 bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center relative overflow-hidden group">
                                      {editingChallenge.imageUrl ? (
                                          <img src={editingChallenge.imageUrl} alt="preview" className="w-full h-full object-contain" />
                                      ) : (
                                          <ImageIcon className="text-gray-300" />
                                      )}
                                      <input type="file" accept="image/*" onChange={handleChallengeImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                          <span className="text-white text-xs font-bold">点击上传</span>
                                      </div>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-2 flex-1">
                                      点击左侧方块上传本地图片，或者点击上方 🍌 按钮让 AI 自动生成。<br/>
                                      {editingChallenge.imageUrl && (
                                          <button onClick={() => setEditingChallenge({...editingChallenge, imageUrl: undefined})} className="block mt-2 text-red-500 hover:underline">删除当前图片</button>
                                      )}
                                  </div>
                              </div>
                          </div>

                          {editingChallenge.type !== 'FILL_BLANK' && (
                              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                  <div className="flex justify-between items-center">
                                      <label className="block text-xs font-bold text-gray-500">选项列表</label>
                                      <div className="flex gap-2">
                                          <button 
                                            onClick={handleGenerateOptions}
                                            disabled={isOptionGenLoading || !editingChallenge.question}
                                            className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-lg font-bold hover:bg-purple-200 disabled:opacity-50 flex items-center gap-1 transition-colors"
                                          >
                                              {isOptionGenLoading ? <Loader2 size={12} className="animate-spin" /> : '✨'} AI 生成选项
                                          </button>
                                          <button 
                                            onClick={() => {
                                                const newId = String.fromCharCode(65 + (editingChallenge.options?.length || 0));
                                                setEditingChallenge({
                                                    ...editingChallenge,
                                                    options: [...(editingChallenge.options || []), { id: newId, text: '' }]
                                                })
                                            }}
                                            className="text-xs text-blue-600 font-bold hover:underline"
                                          >
                                              + 添加选项
                                          </button>
                                      </div>
                                  </div>
                                  {editingChallenge.options?.map((opt, idx) => {
                                      const isMultipleChoice = editingChallenge.type === 'MULTIPLE_CHOICE';
                                      const correctAnswers = editingChallenge.correctAnswer?.split(',') || [];
                                      const isChecked = isMultipleChoice 
                                          ? correctAnswers.includes(opt.id)
                                          : editingChallenge.correctAnswer === opt.id;
                                      
                                      return (
                                          <div key={idx} className="flex gap-2 items-center">
                                              <div className="w-8 h-8 flex items-center justify-center bg-white border rounded font-bold text-gray-500 text-xs">
                                                  {opt.id}
                                              </div>
                                              <input 
                                                type="text" 
                                                className="flex-1 p-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                                                value={opt.text}
                                                onChange={(e) => {
                                                    const newOpts = [...(editingChallenge.options || [])];
                                                    newOpts[idx].text = e.target.value;
                                                    setEditingChallenge({ ...editingChallenge, options: newOpts });
                                                }}
                                              />
                                              {isMultipleChoice ? (
                                                  <input 
                                                    type="checkbox" 
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        let newAnswers = [...correctAnswers];
                                                        if (e.target.checked) {
                                                            if (!newAnswers.includes(opt.id)) {
                                                                newAnswers.push(opt.id);
                                                            }
                                                        } else {
                                                            newAnswers = newAnswers.filter(a => a !== opt.id);
                                                        }
                                                        // 按字母排序
                                                        newAnswers.sort();
                                                        setEditingChallenge({ ...editingChallenge, correctAnswer: newAnswers.join(',') });
                                                    }}
                                                    className="w-4 h-4 text-green-600 rounded"
                                                  />
                                              ) : (
                                                  <input 
                                                    type="radio" 
                                                    name="correctAnswer"
                                                    checked={isChecked}
                                                    onChange={() => setEditingChallenge({ ...editingChallenge, correctAnswer: opt.id })}
                                                    className="w-4 h-4 text-green-600"
                                                  />
                                              )}
                                              <button 
                                                onClick={() => {
                                                    const newOpts = editingChallenge.options?.filter((_, i) => i !== idx);
                                                    // 如果删除的选项是正确答案之一，也要更新 correctAnswer
                                                    let newCorrectAnswer = editingChallenge.correctAnswer;
                                                    if (isMultipleChoice) {
                                                        const answers = correctAnswers.filter(a => a !== opt.id);
                                                        newCorrectAnswer = answers.join(',');
                                                    } else if (editingChallenge.correctAnswer === opt.id) {
                                                        newCorrectAnswer = '';
                                                    }
                                                    setEditingChallenge({ ...editingChallenge, options: newOpts, correctAnswer: newCorrectAnswer });
                                                }}
                                                className="text-gray-400 hover:text-red-500"
                                              >
                                                  <X size={16}/>
                                              </button>
                                          </div>
                                      );
                                  })}
                                  <p className="text-xs text-gray-400 mt-1">
                                      {editingChallenge.type === 'MULTIPLE_CHOICE' 
                                          ? '* 勾选复选框以标记正确答案（可多选）' 
                                          : '* 选中单选框以标记正确答案'}
                                  </p>
                              </div>
                          )}

                          {editingChallenge.type === 'FILL_BLANK' && (
                              <div>
                                  <label className="block text-xs font-bold text-gray-500 mb-1">正确答案 (文本)</label>
                                  <input 
                                    type="text" 
                                    className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-400"
                                    value={editingChallenge.correctAnswer}
                                    placeholder="如果是多空题，请使用 || 分隔答案 (例如: 5||7)"
                                    onChange={(e) => setEditingChallenge({ ...editingChallenge, correctAnswer: e.target.value })}
                                  />
                                  <p className="text-[10px] text-gray-400 mt-1">提示：如果题目中有两个空，请用双竖线 || 分隔两个答案。</p>
                              </div>
                          )}

                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-1">答案解析</label>
                              <textarea 
                                className="w-full p-3 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-green-500 bg-white text-gray-900 placeholder-gray-400"
                                rows={2}
                                value={editingChallenge.explanation}
                                onChange={(e) => setEditingChallenge({ ...editingChallenge, explanation: e.target.value })}
                              />
                          </div>
                      </div>
                  )}
              </div>
          </div>
    );
}
