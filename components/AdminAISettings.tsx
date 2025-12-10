import React, { useState, useEffect } from 'react';
import { Check, X, ChevronDown, Eye, EyeOff, RotateCcw, Loader2, Sparkles, Zap, Settings2, FileText, Image, Layers } from 'lucide-react';
import { AIConfiguration } from '../types';
import { getAIConfig, updateAIConfig, DEFAULT_PROMPTS } from '../api';
import { apiClient } from '../apiClient';

// Vercel-style Select Component
const Select = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
    <div className="relative">
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all cursor-pointer hover:border-gray-300"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
);

// Vercel-style Input Component  
const Input = ({ type = 'text', value, onChange, placeholder, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { value: string; onChange: (v: string) => void }) => (
    <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all hover:border-gray-300 ${className}`}
        {...props}
    />
);

// Vercel-style Slider Component
const Slider = ({ value, onChange, min, max, step, label }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string }) => (
    <div className="space-y-2">
        <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{label}</span>
            <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-black [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110"
        />
    </div>
);

// Status Badge Component
const StatusBadge = ({ status, text }: { status: 'idle' | 'loading' | 'success' | 'error'; text: string }) => {
    const styles = {
        idle: 'bg-gray-100 text-gray-600',
        loading: 'bg-blue-50 text-blue-600',
        success: 'bg-green-50 text-green-600',
        error: 'bg-red-50 text-red-600'
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
            {status === 'loading' && <Loader2 className="w-3 h-3 animate-spin" />}
            {status === 'success' && <Check className="w-3 h-3" />}
            {status === 'error' && <X className="w-3 h-3" />}
            {text}
        </span>
    );
};

export default function AdminAISettings({ userId }: { userId?: string }) {
    const [config, setConfig] = useState<AIConfiguration>();
    const [showKey, setShowKey] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [statusMessage, setStatusMessage] = useState('');
    const [activePromptTab, setActivePromptTab] = useState<'text' | 'image' | 'structure'>('text');
    const [showResetDialog, setShowResetDialog] = useState(false);
    const [resetType, setResetType] = useState<'all' | 'prompt'>('all');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const aiConfig = await getAIConfig(userId);
                setConfig(aiConfig);
            } catch (error) {
                console.error("Failed to load AI config:", error);
            } finally {
                setIsLoading(false);
            }
        };
        
        loadConfig();
    }, [userId]);

    const handleChange = (field: keyof AIConfiguration, value: any) => {
        setConfig(prev => ({ ...prev, [field]: value }));
        setStatus('idle');
    };

    const handleSave = async () => {
        setStatus('loading');
        setStatusMessage('正在测试连接...');
        
        try {
            // Save to both localStorage and database
            await updateAIConfig(config, userId);
            
            // Test the connection
            const testResult = await apiClient.testAIConnection(config);

            if (testResult.success) {
                setStatus('success');
                setStatusMessage('配置已保存');
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
                setStatusMessage(testResult.message || '连接失败');
            }
        } catch (error) {
            setStatus('error');
            setStatusMessage('保存失败: ' + (error as Error).message);
        }
    };

    const handleReset = async () => {
        try {
            if (resetType === 'all') {
                const defaults: AIConfiguration = {
                    provider: 'google',
                    apiKey: '',
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
                await updateAIConfig(defaults, userId);
                setConfig(defaults);
            } else {
                let updates: Partial<AIConfiguration> = {};
                if (activePromptTab === 'text') updates.systemPromptText = DEFAULT_PROMPTS.text;
                if (activePromptTab === 'image') updates.systemPromptImage = DEFAULT_PROMPTS.image;
                if (activePromptTab === 'structure') updates.systemPromptStructure = DEFAULT_PROMPTS.structure;
                const newConfig = { ...config, ...updates };
                setConfig(newConfig);
                await updateAIConfig(newConfig, userId);
            }
            setShowResetDialog(false);
            setStatus('success');
            setStatusMessage('已重置');
            setTimeout(() => setStatus('idle'), 2000);
        } catch (error) {
            setStatus('error');
            setStatusMessage('重置失败: ' + (error as Error).message);
        }
    };

    const providerOptions = [
        { value: 'google', label: 'Google Gemini' },
        { value: 'openai', label: 'OpenAI Compatible' }
    ];

    const getModelSuggestions = () => {
        if (config.provider === 'google') {
            return [
                { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
                { value: 'gemini-2.5-flash-lite-latest', label: 'Gemini 2.5 Flash Lite' },
                { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
            ];
        }
        return [
            { value: 'gpt-4o', label: 'GPT-4o' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
        ];
    };

    const promptTabs = [
        { id: 'text' as const, label: '题目生成', icon: FileText, description: '控制 AI 如何将文本转换为测验题目' },
        { id: 'structure' as const, label: '结构分析', icon: Layers, description: '控制 AI 如何分析长文本并输出章节结构' },
        { id: 'image' as const, label: '配图生成', icon: Image, description: '控制 AI 如何为题目生成配图' }
    ];

    const getCurrentPrompt = () => {
        if (!config) return '';
        switch (activePromptTab) {
            case 'text': return config.systemPromptText || '';
            case 'image': return config.systemPromptImage || '';
            case 'structure': return config.systemPromptStructure || '';
        }
    };

    const setCurrentPrompt = (value: string) => {
        switch (activePromptTab) {
            case 'text': handleChange('systemPromptText', value); break;
            case 'image': handleChange('systemPromptImage', value); break;
            case 'structure': handleChange('systemPromptStructure', value); break;
        }
    };

    if (isLoading || !config) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">加载配置中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Reset Dialog */}
            {showResetDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                {resetType === 'all' ? '重置所有配置' : '重置提示词'}
                            </h3>
                            <p className="text-sm text-gray-500">
                                {resetType === 'all' 
                                    ? '此操作将恢复所有设置（包括提示词）到系统默认状态，无法撤销。' 
                                    : `此操作将重置「${promptTabs.find(t => t.id === activePromptTab)?.label}」提示词为默认值。`}
                            </p>
                        </div>
                        <div className="flex border-t border-gray-100">
                            <button 
                                onClick={() => setShowResetDialog(false)}
                                className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={handleReset}
                                className="flex-1 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors border-l border-gray-100"
                            >
                                确认重置
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-xl z-40">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                                <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-gray-900">AI 配置</h1>
                                <p className="text-xs text-gray-500">配置模型参数与提示词</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {status !== 'idle' && (
                                <StatusBadge status={status} text={statusMessage} />
                            )}
                            <button
                                onClick={() => { setResetType('all'); setShowResetDialog(true); }}
                                className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={status === 'loading'}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {status === 'loading' ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Zap className="w-4 h-4" />
                                )}
                                {status === 'loading' ? '测试中...' : '保存 & 测试'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-5xl mx-auto px-6 py-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Left Column - Provider & Credentials */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Provider Card */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                                <Settings2 className="w-4 h-4" />
                                服务配置
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Provider</label>
                                    <Select
                                        value={config.provider}
                                        onChange={(v) => handleChange('provider', v)}
                                        options={providerOptions}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">API Key</label>
                                    <div className="relative">
                                        <Input
                                            type={showKey ? 'text' : 'password'}
                                            value={config.apiKey}
                                            onChange={(v) => handleChange('apiKey', v)}
                                            placeholder="sk-..."
                                            className="pr-10 font-mono text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowKey(!showKey)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Base URL <span className="text-gray-400">(可选)</span></label>
                                    <Input
                                        value={config.baseUrl || ''}
                                        onChange={(v) => handleChange('baseUrl', v)}
                                        placeholder={config.provider === 'google' ? 'https://generativelanguage.googleapis.com' : 'https://api.openai.com/v1'}
                                        className="font-mono text-xs"
                                    />
                                    <p className="mt-1 text-[10px] text-gray-400">留空使用默认地址，或填写代理地址</p>
                                </div>
                            </div>
                        </div>

                        {/* Models Card */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-4">
                            <div className="text-sm font-medium text-gray-900">模型选择</div>
                            
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">文本模型</label>
                                <Input
                                    value={config.textModel}
                                    onChange={(v) => handleChange('textModel', v)}
                                    placeholder="gemini-2.5-flash"
                                    list="text-models"
                                />
                                <datalist id="text-models">
                                    {getModelSuggestions().map(m => <option key={m.value} value={m.value} />)}
                                </datalist>
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">图像模型</label>
                                <Input
                                    value={config.imageModel}
                                    onChange={(v) => handleChange('imageModel', v)}
                                    placeholder="gemini-2.5-flash-image"
                                />
                            </div>
                        </div>

                        {/* Parameters Card */}
                        <div className="bg-gray-50 rounded-xl p-5 space-y-5">
                            <div className="text-sm font-medium text-gray-900">生成参数</div>
                            
                            <Slider
                                label="Temperature"
                                value={config.temperature}
                                onChange={(v) => handleChange('temperature', v)}
                                min={0}
                                max={2}
                                step={0.1}
                            />

                            {config.provider === 'google' && (
                                <>
                                    <Slider
                                        label="Top P"
                                        value={config.topP}
                                        onChange={(v) => handleChange('topP', v)}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                    />
                                    <Slider
                                        label="Top K"
                                        value={config.topK}
                                        onChange={(v) => handleChange('topK', v)}
                                        min={1}
                                        max={100}
                                        step={1}
                                    />
                                </>
                            )}

                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">Max Tokens</label>
                                <Input
                                    type="number"
                                    value={config.maxOutputTokens ? String(config.maxOutputTokens) : ''}
                                    onChange={(v) => handleChange('maxOutputTokens', v ? parseInt(v) : 0)}
                                    placeholder="留空使用默认值"
                                />
                                <p className="mt-1 text-[10px] text-gray-400">设为 0 或留空表示不限制</p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Prompts */}
                    <div className="lg:col-span-2">
                        <div className="bg-gray-50 rounded-xl overflow-hidden">
                            {/* Prompt Tabs */}
                            <div className="border-b border-gray-200 bg-white">
                                <nav className="flex">
                                    {promptTabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActivePromptTab(tab.id)}
                                            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                                                activePromptTab === tab.id 
                                                    ? 'text-gray-900' 
                                                    : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                <tab.icon className="w-4 h-4" />
                                                {tab.label}
                                            </div>
                                            {activePromptTab === tab.id && (
                                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" />
                                            )}
                                        </button>
                                    ))}
                                </nav>
                            </div>

                            {/* Prompt Editor */}
                            <div className="p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-xs text-gray-500">
                                        {promptTabs.find(t => t.id === activePromptTab)?.description}
                                    </p>
                                    <button
                                        onClick={() => { setResetType('prompt'); setShowResetDialog(true); }}
                                        className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        重置
                                    </button>
                                </div>
                                <textarea
                                    value={getCurrentPrompt()}
                                    onChange={(e) => setCurrentPrompt(e.target.value)}
                                    placeholder="输入系统提示词..."
                                    className="w-full h-[400px] p-4 bg-white border border-gray-200 rounded-lg font-mono text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent resize-none leading-relaxed"
                                />
                                {activePromptTab === 'image' && (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                        <span>可用变量:</span>
                                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{'{{question}}'}</code>
                                        <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{'{{answer}}'}</code>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
