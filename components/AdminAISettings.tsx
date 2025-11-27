
import React, { useState, useEffect } from 'react';
import { Save, RotateCcw, Key, Cpu, Sliders, CheckCircle2, AlertTriangle, Eye, EyeOff, Globe, MessageSquare, Undo2, Loader2, Wifi } from 'lucide-react';
import { AIConfiguration } from '../types';
import { getAIConfig, updateAIConfig, testAIConnection, DEFAULT_PROMPTS } from '../api';

export default function AdminAISettings() {
    const [config, setConfig] = useState<AIConfiguration>(getAIConfig());
    const [showKey, setShowKey] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [activePromptTab, setActivePromptTab] = useState<'text' | 'image' | 'structure'>('text');
    
    // Custom Confirmation Modal State to replace window.confirm
    const [confirmationModal, setConfirmationModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    // Refresh config on mount
    useEffect(() => {
        setConfig(getAIConfig());
    }, []);

    const handleChange = (field: keyof AIConfiguration, value: any) => {
        setConfig(prev => ({
            ...prev,
            [field]: value
        }));
        setIsSaved(false);
    };

    const handleSave = async () => {
        setIsTesting(true);
        // Save locally first to prevent data loss
        updateAIConfig(config);
        
        // Run test
        const testResult = await testAIConnection(config);
        setIsTesting(false);

        if (testResult.success) {
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } else {
            // Show error
            setConfirmationModal({
                title: "连接测试失败",
                message: `配置已保存，但测试连接失败：${testResult.message}。请检查 API Key、Base URL 或模型名称是否正确。`,
                onConfirm: () => setConfirmationModal(null)
            });
        }
    };

    const handleReset = () => {
        setConfirmationModal({
            title: "全局重置确认",
            message: "确定要恢复所有设置（包括提示词）到系统默认状态吗？此操作不可撤销。",
            onConfirm: () => {
                const defaults: AIConfiguration = {
                    provider: 'google',
                    apiKey: process.env.API_KEY || '',
                    baseUrl: '',
                    textModel: 'gemini-2.5-flash',
                    imageModel: 'gemini-2.5-flash-image',
                    temperature: 0.3,
                    topP: 0.95,
                    topK: 40,
                    maxOutputTokens: 40000,
                    systemPromptText: DEFAULT_PROMPTS.text,
                    systemPromptImage: DEFAULT_PROMPTS.image,
                    systemPromptStructure: DEFAULT_PROMPTS.structure
                };
                updateAIConfig(defaults);
                setConfig(defaults);
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 2000);
                setConfirmationModal(null);
            }
        });
    };

    const handleRestoreDefaultPrompts = () => {
        setConfirmationModal({
            title: "重置提示词确认",
            message: "确定要重置当前选中的提示词模板为系统默认值吗？您的自定义修改将丢失。",
            onConfirm: () => {
                let updates: Partial<AIConfiguration> = {};
                if (activePromptTab === 'text') updates.systemPromptText = DEFAULT_PROMPTS.text;
                if (activePromptTab === 'image') updates.systemPromptImage = DEFAULT_PROMPTS.image;
                if (activePromptTab === 'structure') updates.systemPromptStructure = DEFAULT_PROMPTS.structure;
    
                const newConfig = { ...config, ...updates };
                setConfig(newConfig);
                updateAIConfig(newConfig);
                showToast('提示词已重置');
                setConfirmationModal(null);
            }
        });
    };

    // Simple internal toast helper
    const showToast = (msg: string) => {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    return (
        <div className="max-w-4xl mx-auto pb-12 relative">
             {/* Custom Modal Overlay */}
             {confirmationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                            <AlertTriangle className="text-orange-500" />
                            {confirmationModal.title}
                        </h3>
                        <p className="text-gray-600 mb-6 text-sm leading-relaxed">{confirmationModal.message}</p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setConfirmationModal(null)}
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-black text-white hover:bg-gray-800 transition-colors shadow-lg"
                            >
                                确认
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white p-6 md:p-8 rounded-2xl border-2 border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                <div className="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Cpu className="text-blue-500" /> AI 参数配置
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">支持 Google GenAI 原生接口及 OpenAI 兼容接口</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={handleReset}
                            className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-100 rounded-xl flex items-center gap-2 transition-colors"
                        >
                            <RotateCcw size={16} /> 全局重置
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={isTesting}
                            className={`px-6 py-2 text-sm font-bold text-white rounded-xl flex items-center gap-2 transition-all shadow-lg active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed ${isSaved ? 'bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}
                        >
                            {isTesting ? <Loader2 size={16} className="animate-spin" /> : isSaved ? <CheckCircle2 size={16} /> : <Save size={16} />}
                            {isTesting ? '测试连接...' : isSaved ? '已保存' : '保存 & 测试'}
                        </button>
                    </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Column 1: Core Settings */}
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Globe size={14} /> 服务提供商
                            </h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Provider SDK</label>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleChange('provider', 'google')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${config.provider === 'google' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-white border-gray-300 text-gray-500'}`}
                                        >
                                            Google GenAI
                                        </button>
                                        <button 
                                            onClick={() => handleChange('provider', 'openai')}
                                            className={`flex-1 py-2 text-sm font-bold rounded-lg border transition-all ${config.provider === 'openai' ? 'bg-green-100 border-green-500 text-green-700' : 'bg-white border-gray-300 text-gray-500'}`}
                                        >
                                            OpenAI / Compatible
                                        </button>
                                    </div>
                                </div>
                                
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">Base URL (API 代理地址)</label>
                                    <input 
                                        type="text"
                                        value={config.baseUrl || ''}
                                        onChange={(e) => handleChange('baseUrl', e.target.value)}
                                        placeholder={config.provider === 'google' ? "例如: https://aihubmix.com/gemini" : "例如: https://api.openai.com/v1"}
                                        className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-mono text-sm bg-white text-gray-900 placeholder-gray-400"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {config.provider === 'google' 
                                            ? "留空则使用 Google 官方默认地址。如使用 AiHubMix 等代理，请输入完整基础路径。" 
                                            : "连接第三方模型（如 DeepSeek, Moonshot）时必填。"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200">
                            <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Key size={14} /> 凭证与模型
                            </h4>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">API Key</label>
                                    <div className="relative">
                                        <input 
                                            type={showKey ? "text" : "password"}
                                            value={config.apiKey}
                                            onChange={(e) => handleChange('apiKey', e.target.value)}
                                            placeholder="sk-..."
                                            className="w-full pl-4 pr-10 py-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none font-mono text-sm bg-white text-gray-900 placeholder-gray-400"
                                        />
                                        <button 
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">文本生成模型 (Text Model)</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            list="text-models-list"
                                            value={config.textModel}
                                            onChange={(e) => handleChange('textModel', e.target.value)}
                                            placeholder={config.provider === 'google' ? "例如: gemini-2.5-flash" : "例如: gpt-4o"}
                                            className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-sm bg-white text-gray-900 placeholder-gray-400"
                                        />
                                        {config.provider === 'google' && (
                                            <datalist id="text-models-list">
                                                <option value="gemini-2.5-flash" />
                                                <option value="gemini-2.5-flash-lite-latest" />
                                                <option value="gemini-3-pro-preview" />
                                                <option value="gemini-flash-latest" />
                                                <option value="gemini-1.5-pro" />
                                            </datalist>
                                        )}
                                        {config.provider === 'openai' && (
                                            <datalist id="text-models-list">
                                                <option value="gpt-4o" />
                                                <option value="gpt-4-turbo" />
                                                <option value="gpt-3.5-turbo" />
                                                <option value="deepseek-chat" />
                                            </datalist>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">图像生成模型 (Image Model)</label>
                                    <div className="relative">
                                        <input 
                                            type="text"
                                            list="image-models-list"
                                            value={config.imageModel}
                                            onChange={(e) => handleChange('imageModel', e.target.value)}
                                            placeholder={config.provider === 'google' ? "例如: gemini-2.5-flash-image" : "例如: dall-e-3"}
                                            className="w-full p-3 rounded-xl border-2 border-gray-200 focus:border-blue-500 outline-none text-sm bg-white text-gray-900 placeholder-gray-400"
                                        />
                                        {config.provider === 'google' && (
                                            <datalist id="image-models-list">
                                                <option value="gemini-2.5-flash-image" />
                                                <option value="gemini-3-pro-image-preview" />
                                            </datalist>
                                        )}
                                        {config.provider === 'openai' && (
                                            <datalist id="image-models-list">
                                                <option value="dall-e-3" />
                                                <option value="dall-e-2" />
                                            </datalist>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Parameters */}
                    <div className="space-y-6">
                        <div className="bg-gray-50 p-5 rounded-2xl border border-gray-200 h-full">
                             <h4 className="text-sm font-bold text-gray-500 uppercase mb-4 flex items-center gap-2">
                                <Sliders size={14} /> 生成参数 (Generation Config)
                            </h4>

                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-700">Temperature (随机性)</label>
                                        <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 rounded">{config.temperature}</span>
                                    </div>
                                    <input 
                                        type="range" min="0" max="2" step="0.1"
                                        value={config.temperature}
                                        onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
                                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">值越高，回答越有创意但可能不准确；值越低，回答越保守。</p>
                                </div>

                                {config.provider === 'google' && (
                                    <>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-bold text-gray-700">Top P (核采样)</label>
                                                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 rounded">{config.topP}</span>
                                            </div>
                                            <input 
                                                type="range" min="0" max="1" step="0.01"
                                                value={config.topP}
                                                onChange={(e) => handleChange('topP', parseFloat(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <label className="text-xs font-bold text-gray-700">Top K</label>
                                                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 rounded">{config.topK}</span>
                                            </div>
                                            <input 
                                                type="range" min="1" max="100" step="1"
                                                value={config.topK}
                                                onChange={(e) => handleChange('topK', parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <div className="flex justify-between mb-1">
                                        <label className="text-xs font-bold text-gray-700">Max Output Tokens</label>
                                        <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 rounded">
                                            {config.maxOutputTokens > 0 ? config.maxOutputTokens : 'Default'}
                                        </span>
                                    </div>
                                    <input 
                                        type="number"
                                        value={config.maxOutputTokens || ''}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            handleChange('maxOutputTokens', isNaN(val) ? 0 : val);
                                        }}
                                        placeholder="0 或留空表示默认 (无限制)"
                                        className="w-full p-2 rounded-lg border border-gray-300 text-sm bg-white text-gray-900 placeholder-gray-400"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        设为 0 表示不限制（使用模型默认最大长度）。
                                        <br/>如果遇到 <span className="font-mono bg-gray-200 px-1 rounded text-red-500">max_tokens &lt;= 32768</span> 报错，请将此项清空或设为 0。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Prompt Engineering Section --- */}
            <div className="mt-8 bg-white p-6 md:p-8 rounded-2xl border-2 border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-8">
                <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-100">
                     <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <MessageSquare className="text-purple-500" /> 提示词工程 (Prompt Engineering)
                    </h3>
                    <button 
                        onClick={handleRestoreDefaultPrompts}
                        className="text-xs font-bold text-gray-500 hover:text-purple-600 flex items-center gap-1 transition-colors px-3 py-1 bg-gray-50 rounded-lg border border-gray-200"
                    >
                        <Undo2 size={14} /> 恢复默认提示词
                    </button>
                </div>

                <div className="flex gap-2 mb-4 bg-gray-100 p-1 rounded-xl w-fit">
                    <button 
                        onClick={() => setActivePromptTab('text')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptTab === 'text' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        题目生成提示词
                    </button>
                    <button 
                        onClick={() => setActivePromptTab('structure')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptTab === 'structure' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        结构化生成提示词
                    </button>
                    <button 
                        onClick={() => setActivePromptTab('image')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptTab === 'image' ? 'bg-white shadow text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        配图生成提示词
                    </button>
                </div>

                <div className="relative">
                    {activePromptTab === 'text' && (
                        <div className="space-y-2 animate-in fade-in">
                            <label className="block text-xs font-bold text-gray-500">System Instruction for Quiz Generation</label>
                            <textarea 
                                value={config.systemPromptText || ''}
                                onChange={(e) => handleChange('systemPromptText', e.target.value)}
                                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl font-mono text-sm bg-gray-50 focus:bg-white focus:border-purple-500 outline-none text-gray-900 leading-relaxed"
                                placeholder="输入系统提示词..."
                            />
                            <p className="text-[10px] text-gray-400">控制 AI 如何将文本内容转换为 JSON 格式的题目。</p>
                        </div>
                    )}

                    {activePromptTab === 'structure' && (
                        <div className="space-y-2 animate-in fade-in">
                            <label className="block text-xs font-bold text-gray-500">System Instruction for Course Structure</label>
                            <textarea 
                                value={config.systemPromptStructure || ''}
                                onChange={(e) => handleChange('systemPromptStructure', e.target.value)}
                                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl font-mono text-sm bg-gray-50 focus:bg-white focus:border-purple-500 outline-none text-gray-900 leading-relaxed"
                                placeholder="输入系统提示词..."
                            />
                            <p className="text-[10px] text-gray-400">控制 AI 如何分析长文本并输出章节结构。</p>
                        </div>
                    )}

                    {activePromptTab === 'image' && (
                        <div className="space-y-2 animate-in fade-in">
                            <label className="block text-xs font-bold text-gray-500">Image Generation Prompt Template</label>
                            <textarea 
                                value={config.systemPromptImage || ''}
                                onChange={(e) => handleChange('systemPromptImage', e.target.value)}
                                className="w-full h-64 p-4 border-2 border-gray-200 rounded-xl font-mono text-sm bg-gray-50 focus:bg-white focus:border-purple-500 outline-none text-gray-900 leading-relaxed"
                                placeholder="输入图片生成提示词模板..."
                            />
                            <div className="flex gap-2 text-[10px] text-gray-400">
                                <span>可用变量:</span>
                                <code className="bg-gray-100 px-1 rounded text-gray-600">{"{{question}}"}</code>
                                <code className="bg-gray-100 px-1 rounded text-gray-600">{"{{answer}}"}</code>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
