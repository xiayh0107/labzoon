
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";
import { KnowledgeItem, Challenge, AIConfiguration } from './types';
import { apiClient } from './apiClient';

// --- Default Prompts ---

export const DEFAULT_PROMPTS = {
    text: `你是一位医学实验动物学专家教授。
你的任务是根据用户提供的内容（文本或图片），生成适合Duolingo风格的学习软件的测验题目。

核心目标：不仅考察记忆，更要考察逻辑理解。

生成规则：
1. 题目数量：分解材料，根据知识点密度，单个知识点的考察要有，也要注意材料中描述的总体步骤等的考察，帮助学生记忆操作流程，操作要点，操作细节。为材料生成足够数量的题目(每个知识点5-10个考察题目，还要有全局性的梳理类题目至少有5-10个，比如知道正确的实验步骤，操作步骤之类的系统性梳理和总览性的考察)。
2. 题目类型: SINGLE_CHOICE (单选), MULTIPLE_CHOICE (多选), TRUE_FALSE (判断), FILL_BLANK (填空).
3. 【重要】针对分类与逻辑关系（如：包含关系、对比关系、层级结构）：
   - 请生成 **归类题**（例如：“X属于下列哪一类？”）。
   - 请生成 **排除题**（例如：“以下哪项不属于X的亚型？”）。
   - 请生成 **辨析题**（例如：“X与Y的主要区别是？”）。
   - 如果内容包含“相同/不同基因型”等对立概念，请务必出题考察这种区分。
4. 【重要】选项格式 (SINGLE_CHOICE, MULTIPLE_CHOICE 和 TRUE_FALSE)：
   - SINGLE_CHOICE: 必须为对象数组: [{"id": "A", "text": "选项内容"}, {"id": "B", "text": "选项内容"}]。
   - MULTIPLE_CHOICE: 必须为对象数组: [{"id": "A", "text": "选项内容"}, {"id": "B", "text": "选项内容"}]。
   - TRUE_FALSE: 必须包含两个选项: [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}] (或其他合适的对立选项)。
   - 干扰项必须具有一定的迷惑性，不能一眼即假。
5. 【重要】FILL_BLANK 规则：
    - 如果只需要填一个词，'correctAnswer' 设为该词。
    - 如果需要填多个词（多空），请在 'correctAnswer' 中使用双竖线 '||' 分隔。例如："5||7"。
    - 题干中请用 '___' 表示填空位置。
6. Language: Simplified Chinese.

输出必须是纯 JSON 数组 (不要使用 Markdown 代码块)。
示例结构：
[
  {
    "type": "SINGLE_CHOICE",
    "question": "重组近交系（Recombinant Inbred Strains）属于以下哪种遗传分类？",
    "options": [{"id": "A", "text": "相同基因型"}, {"id": "B", "text": "不同基因型"}, {"id": "C", "text": "封闭群"}],
    "correctAnswer": "A",
    "explanation": "根据分类图谱，重组近交系是近交系的一种，属于具有相同基因型的品系。"
  },
  {
    "type": "MULTIPLE_CHOICE",
    "question": "以下哪些是近交系的特点？（多选）",
    "options": [{"id": "A", "text": "基因高度纯合"}, {"id": "B", "text": "个体间基因型一致"}, {"id": "C", "text": "遗传多样性高"}],
    "correctAnswer": "A||B",
    "explanation": "近交系经过20代以上的全同胞兄妹交配，基因纯合度极高，个体间基因型基本一致，但遗传多样性低。"
  },
  {
    "type": "TRUE_FALSE",
    "question": "近交系小鼠的基因型是完全相同的。",
    "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}],
    "correctAnswer": "A",
    "explanation": "近交系经过20代以上的全同胞兄妹交配，基因纯合度极高，个体间基因型基本一致。"
  },
  {
    "type": "FILL_BLANK",
    "question": "近交系通常需要经过___代以上的全同胞兄妹交配才能建立。",
    "correctAnswer": "20",
    "explanation": "根据标准定义，近交系需要经过20代以上的全同胞兄妹交配。"
  }
]`,

    image: `Create a clear, educational, scientific illustration style image for a medical zoology quiz.

The User Question is: "{{question}}"
The Visual Focus (Correct Answer) is: "{{answer}}"

Instructions:
1. Visualize the concept described in the 'Visual Focus' within the context of the question.
2. Keep it clean, minimalist, suitable for a mobile app learning context.
3. White background preferred.
4. CRITICAL: The image must NOT contain any text, letters, numbers, or labels. Do not reveal the answer via text.`,

    structure: `你是一位医学动物实验课的课程架构师。你的任务是分析提供的文本，将其重组为结构化的课程内容，帮助学生记忆操作流程，操作要点，操作细节。

任务目标：
1. 识别文本中的“章”（Units）和“节”（Lessons），或者合适符合知识结构的分段。
2. 如果文本包含多个章节，请创建多个 Unit。如果只是一个章节的内容，创建一个 Unit 并划分 Lessons。
3. 为每个 Lesson 中包含的内容，根据知识点密度，单个知识点的考察要有，也要注意材料中描述的总体步骤等的考察，为材料生成足够数量的题目(每个知识点5-10个考察题目，还要有全局性的梳理类题目至少有5-10个，比如知道正确的实验步骤，操作步骤之类的系统性梳理和总览性的考察)。

题目生成规则：
- 类型包括 SINGLE_CHOICE (单选), MULTIPLE_CHOICE (多选), TRUE_FALSE (判断), FILL_BLANK (填空).
- SINGLE_CHOICE, MULTIPLE_CHOICE 和 TRUE_FALSE 必须有 options。
  - SINGLE_CHOICE: [{"id":"A", "text":"..."}]
  - MULTIPLE_CHOICE: [{"id":"A", "text":"..."}]
  - TRUE_FALSE: [{"id":"A", "text":"正确"}, {"id":"B", "text":"错误"}]
- FILL_BLANK 多空答案用 "||" 分隔。

Language: Simplified Chinese.
输出格式：JSON 数组。
JSON 结构示例 (必须严格遵守键名):
[
  {
    "title": "章节标题",
    "description": "章节描述",
    "lessons": [
      {
        "title": "小节标题",
        "challenges": [
          {
            "type": "SINGLE_CHOICE",
            "question": "问题内容...",
            "options": [{"id": "A", "text": "选项A"}],
            "correctAnswer": "A",
            "explanation": "解析..."
          },
          {
            "type": "MULTIPLE_CHOICE",
            "question": "以下哪些是正确的？（多选）",
            "options": [{"id": "A", "text": "选项A"}, {"id": "B", "text": "选项B"}],
            "correctAnswer": "A||B",
            "explanation": "解析..."
          },
          {
            "type": "TRUE_FALSE",
            "question": "判断题内容...",
            "options": [{"id": "A", "text": "正确"}, {"id": "B", "text": "错误"}],
            "correctAnswer": "A",
            "explanation": "解析..."
          },
          {
            "type": "FILL_BLANK",
            "question": "填空题内容：___是答案。",
            "correctAnswer": "答案",
            "explanation": "解析..."
          }
        ]
      }
    ]
  }
]`
};

// --- Configuration State ---

// Helper to get env value with fallback
const getEnvNumber = (key: string, fallback: number): number => {
    const val = import.meta.env[key];
    if (val === undefined || val === '') return fallback;
    const num = parseFloat(val);
    return isNaN(num) ? fallback : num;
};

// Get API key based on provider
const getDefaultApiKey = (): string => {
    const provider = import.meta.env.VITE_AI_PROVIDER || 'google';
    if (provider === 'openai') {
        return import.meta.env.VITE_OPENAI_API_KEY || '';
    }
    return import.meta.env.VITE_GEMINI_API_KEY || '';
};

// Default Configuration from environment variables
const getDefaultAIConfig = (): AIConfiguration => ({
    provider: (import.meta.env.VITE_AI_PROVIDER as 'google' | 'openai') || 'google',
    apiKey: getDefaultApiKey(),
    baseUrl: import.meta.env.VITE_AI_BASE_URL || '',
    textModel: import.meta.env.VITE_AI_TEXT_MODEL || 'gemini-2.5-flash',
    imageModel: import.meta.env.VITE_AI_IMAGE_MODEL || 'gemini-2.5-flash-image',
    temperature: getEnvNumber('VITE_AI_TEMPERATURE', 0.3),
    topP: getEnvNumber('VITE_AI_TOP_P', 0.95),
    topK: getEnvNumber('VITE_AI_TOP_K', 40),
    maxOutputTokens: getEnvNumber('VITE_AI_MAX_OUTPUT_TOKENS', 40000),
    systemPromptText: DEFAULT_PROMPTS.text,
    systemPromptImage: DEFAULT_PROMPTS.image,
    systemPromptStructure: DEFAULT_PROMPTS.structure
});

let aiConfig: AIConfiguration = getDefaultAIConfig();

// Try to load from localStorage on init (Client side only)
// NOTE: This initial load is just for fallback/global state. 
// Ideally components should request config for a specific user.
try {
    const savedUser = localStorage.getItem('labzoon_ai_config_user'); // Legacy key, kept for migration if needed
    if (savedUser) {
        const parsedUser = JSON.parse(savedUser);
        aiConfig = { ...aiConfig, ...parsedUser };
    } else {
        const savedConfig = localStorage.getItem('labzoon_ai_config'); // Global config
        if (savedConfig) {
            const parsed = JSON.parse(savedConfig);
            aiConfig = { ...aiConfig, ...parsed };
        }
    }
    // Ensure defaults exist
    if (!aiConfig.systemPromptText) aiConfig.systemPromptText = DEFAULT_PROMPTS.text;
    if (!aiConfig.systemPromptImage) aiConfig.systemPromptImage = DEFAULT_PROMPTS.image;
    if (!aiConfig.systemPromptStructure) aiConfig.systemPromptStructure = DEFAULT_PROMPTS.structure;
    if (aiConfig.systemPromptStructure && !aiConfig.systemPromptStructure.includes("JSON 结构示例")) {
        aiConfig.systemPromptStructure = DEFAULT_PROMPTS.structure;
    }
    if (!aiConfig.apiKey) {
        aiConfig.apiKey = getDefaultApiKey();
    }
} catch {}

export const updateAIConfig = async (newConfig: Partial<AIConfiguration>, userId?: string) => {
    // If userId provided, save to user-specific key
    if (userId) {
        try {
            const current = await getAIConfig(userId);
            const updated = { ...current, ...newConfig };
            
            // Save to localStorage
            localStorage.setItem(`labzoon_ai_config_${userId}`, JSON.stringify(updated));
            
            // Also save to database
            try {
                await apiClient.updateUserAISettings({
                    provider: updated.provider,
                    api_key: updated.apiKey,
                    base_url: updated.baseUrl,
                    text_model: updated.textModel,
                    image_model: updated.imageModel,
                    temperature: updated.temperature,
                    top_p: updated.topP,
                    top_k: updated.topK,
                    max_output_tokens: updated.maxOutputTokens,
                    system_prompt_text: updated.systemPromptText,
                    system_prompt_image: updated.systemPromptImage,
                    system_prompt_structure: updated.systemPromptStructure,
                });
            } catch (dbError) {
                console.warn('Failed to save user settings to database, but localStorage was updated:', dbError);
            }
            
            // Also update the global variable if this is the current active context
            // (This is a simplification, ideally we shouldn't rely on a global variable)
            aiConfig = updated; 
        } catch (e) {
            console.error("Failed to save user config", e);
        }
    } else {
        console.warn('Updating global AI config. This might affect all users if not careful.');
        // Fallback to global update
        aiConfig = { ...aiConfig, ...newConfig };
        try {
            localStorage.setItem('labzoon_ai_config', JSON.stringify(aiConfig));
        } catch (e) {
            console.error("Failed to save config", e);
        }
    }
};

export const getAIConfig = async (userId?: string): Promise<AIConfiguration> => {
    // If userId provided, try to load user-specific config
    if (userId) {
        try {
            // First try to load from database (has priority over localStorage)
            try {
                // Use static import instead of dynamic import to avoid module resolution issues
                const userSettings = await apiClient.getUserAISettings();
                if (userSettings) {
                    const defaultConfig = getDefaultAIConfig();
                    // Map database fields to frontend fields
                    const mappedSettings = {
                        provider: userSettings.provider || defaultConfig.provider,
                        apiKey: userSettings.api_key || defaultConfig.apiKey,
                        baseUrl: userSettings.base_url || defaultConfig.baseUrl,
                        textModel: userSettings.text_model || defaultConfig.textModel,
                        imageModel: userSettings.image_model || defaultConfig.imageModel,
                        temperature: userSettings.temperature ?? defaultConfig.temperature,
                        topP: userSettings.top_p ?? defaultConfig.topP,
                        topK: userSettings.top_k ?? defaultConfig.topK,
                        maxOutputTokens: userSettings.max_output_tokens ?? defaultConfig.maxOutputTokens,
                        systemPromptText: userSettings.system_prompt_text || DEFAULT_PROMPTS.text,
                        systemPromptImage: userSettings.system_prompt_image || DEFAULT_PROMPTS.image,
                        systemPromptStructure: userSettings.system_prompt_structure || DEFAULT_PROMPTS.structure,
                    };
                    
                    // Ensure API Key (if not in database, use env default)
                    if (!mappedSettings.apiKey) mappedSettings.apiKey = getDefaultApiKey();
                    
                    // Also save to localStorage for offline access
                    localStorage.setItem(`labzoon_ai_config_${userId}`, JSON.stringify(mappedSettings));
                    
                    return mappedSettings;
                }
            } catch (dbError: any) {
                console.warn('Failed to load user settings from database, falling back to localStorage:', dbError);
                // If it's a network or server error, don't retry immediately
                if (dbError.name === 'TypeError' && dbError.message.includes('JSON')) {
                    console.error('Server returned non-JSON response. Server may be down or API endpoint incorrect.');
                }
            }
            
            // Fallback to localStorage
            const savedUser = localStorage.getItem(`labzoon_ai_config_${userId}`);
            if (savedUser) {
                const parsedUser = JSON.parse(savedUser);
                const defaultConfig = getDefaultAIConfig();
                const merged = { ...defaultConfig, ...parsedUser };
                
                // Ensure defaults
                if (!merged.systemPromptText) merged.systemPromptText = DEFAULT_PROMPTS.text;
                if (!merged.systemPromptImage) merged.systemPromptImage = DEFAULT_PROMPTS.image;
                if (!merged.systemPromptStructure) merged.systemPromptStructure = DEFAULT_PROMPTS.structure;
                
                // Ensure API Key (if not overridden by user, use env default)
                // Note: If user explicitly cleared it, it might be empty string, which is fine if they want to use backend proxy
                if (!merged.apiKey && !parsedUser.apiKey) merged.apiKey = getDefaultApiKey();
                
                return merged;
            }
        } catch {}
    }

    // Fallback to legacy/global config
    try {
        const savedUser = localStorage.getItem('labzoon_ai_config_user'); // Try legacy user key
        if (savedUser) {
            const parsedUser = JSON.parse(savedUser);
            const merged = { ...aiConfig, ...parsedUser };
            if (!merged.apiKey) merged.apiKey = getDefaultApiKey();
            return merged;
        }
    } catch {}
    return { ...aiConfig };
};

// Check if we should use backend API (production mode)
const useBackendAPI = (): boolean => {
    // Use backend if API_URL is set to relative path (production) or explicitly enabled
    const apiUrl = import.meta.env.VITE_API_URL || '';
    return apiUrl.startsWith('/api') || apiUrl === '';
};

// --- Helper: Clean Markdown JSON ---
// Robustly extracts JSON array or object from potentially messy text
const cleanJsonOutput = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    
    // 1. Try to find JSON block in markdown
    const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
    if (jsonBlockMatch) {
        return jsonBlockMatch[1];
    }
    
    // 2. Try to find generic code block
    const codeBlockMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/i);
    if (codeBlockMatch) {
        return codeBlockMatch[1];
    }

    // 3. Fallback: Try to find the outermost array [] or object {}
    // This helps when models chatter before/after the JSON
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) return arrayMatch[0];
    
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (objectMatch) return objectMatch[0];

    return cleaned;
};

// --- Helper: Normalize Question Data ---
// Ensures that questions generated by loosely-typed LLMs have the correct structure
const normalizeQuestions = (data: any[]): any[] => {
    return data.map((q: any, idx: number) => {
        let options = q.options;
        
        // Fix: Convert string array options ["A", "B"] to object array [{id:"A", text:"A"}, ...]
        if (Array.isArray(options) && typeof options[0] === 'string') {
            options = options.map((optText: string, optIdx: number) => ({
                id: String.fromCharCode(65 + optIdx), // A, B, C...
                text: optText
            }));
        }

        // Fix: Ensure ID exists
        return {
            ...q,
            options: options,
            id: q.id || `gen-norm-${Date.now()}-${idx}`
        };
    });
};

// --- Helper: Robust OpenAI Completion ---
// Handles retry logic for models that require 'max_completion_tokens' instead of 'max_tokens'
const createOpenAICompletion = async (openai: OpenAI, config: any) => {
    try {
        return await openai.chat.completions.create(config);
    } catch (error: any) {
        // Handle "max_tokens" not supported (e.g., o1 models or specific providers)
        // Error messages can vary: "Unsupported parameter: 'max_tokens'", "max_tokens is not supported", etc.
        const errorMsg = (error?.message || error?.error?.message || "").toLowerCase();
        const isMaxTokensError = errorMsg.includes("max_tokens") || error?.status === 400;

        if (isMaxTokensError && config.max_tokens) {
            console.warn("OpenAI call failed with max_tokens. Retrying with max_completion_tokens...");
            const { max_tokens, ...rest } = config;
            return await openai.chat.completions.create({
                ...rest,
                max_completion_tokens: max_tokens
            });
        }
        throw error;
    }
};

// --- API Test Helper ---

export const testAIConnection = async (config: AIConfiguration): Promise<{ success: boolean; message?: string }> => {
    try {
        const testPrompt = "Hello";
        if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined,
                dangerouslyAllowBrowser: true
            });
            
            await createOpenAICompletion(openai, {
                model: config.textModel,
                messages: [{ role: "user", content: testPrompt }],
                max_tokens: 5 // Default small token count for test
            });
        } else {
            // Google GenAI
            const options: any = { apiKey: config.apiKey };
            if (config.baseUrl) {
                options.httpOptions = { baseUrl: config.baseUrl };
            }

            const ai = new GoogleGenAI(options);
            await ai.models.generateContent({
                model: config.textModel,
                contents: { parts: [{ text: testPrompt }] },
            });
        }
        return { success: true };
    } catch (e: any) {
        console.error("Test connection failed", e);
        return { success: false, message: e.message || "Unknown error" };
    }
};

// --- File Helpers ---

export const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

// --- AI Helpers ---

// Generate image from text
export const generateImageForText = async (questionText: string, answerContext: string = '', userId?: string): Promise<string | null> => {
    // Get config for specific user
    const config = await getAIConfig(userId);

    // Replace placeholders in the stored prompt
    const prompt = config.systemPromptImage
        .replace('{{question}}', questionText)
        .replace('{{answer}}', answerContext);

    try {
        if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined,
                dangerouslyAllowBrowser: true
            });
            
            // Allow any custom model name defined in config. 
            // Do NOT fallback to 'dall-e-3' if the user specified something else.
            const response = await openai.images.generate({
                model: config.imageModel || 'dall-e-3', 
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            });
            const b64 = response.data[0].b64_json;
            return b64 ? `data:image/png;base64,${b64}` : null;
        } else {
            // Google GenAI
            const options: any = { apiKey: config.apiKey };
            if (config.baseUrl) {
                options.httpOptions = { baseUrl: config.baseUrl };
            }

            const ai = new GoogleGenAI(options);
            const response = await ai.models.generateContent({
                model: config.imageModel,
                contents: { parts: [{ text: prompt }] },
                config: { imageConfig: { aspectRatio: "1:1" } }
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (e) {
        console.error("Image gen failed", e);
        return null;
    }
};

// Generate Quiz Questions
export const generateQuizQuestions = async (promptText: string, imagePart: any = null, userId?: string): Promise<Challenge[]> => {
    // If userId is provided, ensure global state is synced (simplification for now)
    // Ideally we should just use local config variable instead of global `aiConfig`
    const config = await getAIConfig(userId);
    
    if (!config.apiKey) {
        throw new Error("API key is missing. Please check your configuration.");
    }
    const systemInstruction = config.systemPromptText;

    // Try to use backend API first (more secure, no browser API key exposure)
    if (useBackendAPI() && !imagePart) {
        try {
            const questions = await apiClient.generateQuestions(promptText, systemInstruction, config);
            return questions.map((q: any, idx: number) => ({
                ...q,
                id: q.id || `gen-api-${Date.now()}-${idx}`
            }));
        } catch (error) {
            console.warn('Backend API failed, falling back to direct API call:', error);
            // Fall through to direct API call
        }
    }

    // Direct API call (fallback or when image is included)
    try {
        if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined,
                dangerouslyAllowBrowser: true
            });

            const messages: any[] = [
                { role: "system", content: systemInstruction },
                { role: "user", content: promptText }
            ];

            if (imagePart) {
               const dataUrl = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
               messages[1] = {
                   role: "user",
                   content: [
                       { type: "text", text: promptText },
                       { type: "image_url", image_url: { url: dataUrl } }
                   ]
               };
            }

            // Dynamically construct config
            const completionConfig: any = {
                model: config.textModel,
                messages: messages,
                temperature: config.temperature,
                // REMOVED response_format: { type: "json_object" } for better compatibility
            };
            
            // Only add max_tokens if explicitly set > 0. If 0 or undefined, let model use default (e.g., full context)
            if (config.maxOutputTokens && config.maxOutputTokens > 0) {
                completionConfig.max_tokens = config.maxOutputTokens;
            }

            // USE HELPER HERE
            const response = await createOpenAICompletion(openai, completionConfig);

            const rawContent = response.choices[0].message.content;
            if (rawContent) {
                let data;
                try {
                     const cleanContent = cleanJsonOutput(rawContent);
                     data = JSON.parse(cleanContent);
                     
                     if (!Array.isArray(data) && data.questions) {
                         data = data.questions;
                     } else if (!Array.isArray(data) && data.items) {
                         data = data.items;
                     }
                } catch(e) {
                     console.error("Failed to parse OpenAI JSON", e);
                     return [];
                }

                if (Array.isArray(data)) {
                    // Apply normalization
                    return normalizeQuestions(data).map((q: any, idx: number) => ({
                        ...q,
                        id: `gen-oa-${Date.now()}-${idx}`
                    }));
                }
            }
        } else {
            const options: any = { apiKey: config.apiKey };
            if (config.baseUrl) {
                options.httpOptions = { baseUrl: config.baseUrl };
            }

            const ai = new GoogleGenAI(options);
            const parts: any[] = [{ text: promptText }];
            if (imagePart) parts.unshift(imagePart);
            
            // Google config
            const genConfig: any = {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
                responseSchema: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING, enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK"] },
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            id: { type: Type.STRING },
                            text: { type: Type.STRING }
                          },
                          required: ["id", "text"]
                        }
                      },
                      correctAnswer: { type: Type.STRING, description: "For multiple blanks, separate answers with '||'" },
                      explanation: { type: Type.STRING }
                    },
                    required: ["type", "question", "correctAnswer", "explanation"]
                  }
                }
            };

            // Only add maxOutputTokens if explicitly set > 0
            if (config.maxOutputTokens && config.maxOutputTokens > 0) {
                genConfig.maxOutputTokens = config.maxOutputTokens;
            }

            const response = await ai.models.generateContent({
              model: config.textModel,
              contents: { parts },
              config: genConfig
            });

            if (response.text) {
                const data = JSON.parse(response.text);
                return data.map((q: any, idx: number) => ({
                  ...q,
                  id: `gen-${Date.now()}-${idx}`
                }));
            }
        }
    } catch (err) {
        console.error("AI Generation Error:", err);
        throw err;
    }
    return [];
};

// Generate Options for a specific question
export const generateOptionsForQuestion = async (questionText: string, type: string, userId?: string): Promise<any[]> => {
    const config = getAIConfig(userId);
    if (!config.apiKey) {
        throw new Error("API key is missing. Please check your configuration.");
    }

    const prompt = `你是一个辅助出题的AI助手。
任务：为以下题目生成选项。
题目内容：${questionText}
题目类型：${type}

要求：
1. 如果是 TRUE_FALSE (判断题)，请生成两个选项（如：正确/错误，是/否）。
2. 如果是 MULTIPLE_CHOICE (单选题)，请生成4个选项，其中一个是正确答案，三个是干扰项。
3. 输出格式必须是纯 JSON 数组：[{"id": "A", "text": "选项1"}, {"id": "B", "text": "选项2"}]。
4. 不要包含任何其他文字。`;

    try {
        if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined,
                dangerouslyAllowBrowser: true
            });

            const response = await createOpenAICompletion(openai, {
                model: config.textModel,
                messages: [{ role: "user", content: prompt }],
                temperature: 0.7,
            });

            const rawContent = response.choices[0].message.content;
            if (rawContent) {
                const cleanContent = cleanJsonOutput(rawContent);
                const data = JSON.parse(cleanContent);
                return Array.isArray(data) ? data : [];
            }
        } else {
            // Google GenAI
            const options: any = { apiKey: config.apiKey };
            if (config.baseUrl) {
                options.httpOptions = { baseUrl: config.baseUrl };
            }

            const ai = new GoogleGenAI(options);
            const response = await ai.models.generateContent({
                model: config.textModel,
                contents: { parts: [{ text: prompt }] },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                text: { type: Type.STRING }
                            },
                            required: ["id", "text"]
                        }
                    }
                }
            });

            if (response.text) {
                return JSON.parse(response.text);
            }
        }
    } catch (e) {
        console.error("Generate options failed", e);
        throw e;
    }
    return [];
};

export interface StructuredLesson {
  title: string;
  challenges: any[];
}

export interface StructuredUnit {
  title: string;
  description: string;
  lessons: StructuredLesson[];
}

// Structured Generator
export const generateStructuredCourseContent = async (text: string, userId?: string): Promise<StructuredUnit[]> => {
    const config = await getAIConfig(userId);
    if (!config.apiKey) {
        throw new Error("API key is missing. Please check your configuration.");
    }
    const systemInstruction = config.systemPromptStructure;

    // Try to use backend API first
    if (useBackendAPI()) {
        try {
            const units = await apiClient.generateStructure(text, systemInstruction, config);
            return units.map((unit: any, unitIdx: number) => ({
                ...unit,
                id: unit.id || `unit-api-${Date.now()}-${unitIdx}`,
                color: unit.color || ['green', 'blue', 'purple', 'orange'][unitIdx % 4],
                lessons: (unit.lessons || []).map((lesson: any, lessonIdx: number) => ({
                    ...lesson,
                    id: lesson.id || `lesson-api-${Date.now()}-${unitIdx}-${lessonIdx}`,
                    completed: false,
                    locked: lessonIdx > 0,
                    stars: 0
                }))
            }));
        } catch (error) {
            console.warn('Backend API failed, falling back to direct API call:', error);
            // Fall through to direct API call
        }
    }

    // Direct API call (fallback)
    try {
        if (config.provider === 'openai') {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined,
                dangerouslyAllowBrowser: true
            });

            // Dynamically construct config
            const completionConfig: any = {
                model: config.textModel,
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: text }
                ],
                temperature: config.temperature,
                // REMOVED response_format: { type: "json_object" }
            };

             // Only add max_tokens if explicitly set > 0
             if (config.maxOutputTokens && config.maxOutputTokens > 0) {
                completionConfig.max_tokens = config.maxOutputTokens;
            }

            // USE HELPER HERE
            const response = await createOpenAICompletion(openai, completionConfig);

            const rawContent = response.choices[0].message.content;
            if (rawContent) {
                 const cleanContent = cleanJsonOutput(rawContent);
                 let data = JSON.parse(cleanContent);
                 // Handle wrappers
                 if (!Array.isArray(data)) {
                     if (data.units) data = data.units;
                     else if (data.data) data = data.data;
                     else if (data.items) data = data.items;
                     // Last resort: check if keys contain array
                     else {
                         const values = Object.values(data);
                         const arr = values.find(v => Array.isArray(v));
                         if (arr) data = arr;
                     }
                 }
                 
                 // Normalize challenges inside lessons
                 if (Array.isArray(data)) {
                     data = data.map((unit: any) => ({
                         ...unit,
                         lessons: unit.lessons?.map((lesson: any) => ({
                             ...lesson,
                             challenges: normalizeQuestions(lesson.challenges || lesson.questions || [])
                         }))
                     }));
                 }

                 return Array.isArray(data) ? data : [];
            }
        } else {
            // Google GenAI
            const options: any = { apiKey: config.apiKey };
            if (config.baseUrl) {
                options.httpOptions = { baseUrl: config.baseUrl };
            }
            const ai = new GoogleGenAI(options);

             // Google config
             const genConfig: any = {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                temperature: config.temperature,
                topP: config.topP,
                topK: config.topK,
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Chapter/Unit Title" },
                            description: { type: Type.STRING, description: "Short description of the unit" },
                            lessons: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING, description: "Section/Lesson Title" },
                                        challenges: {
                                            type: Type.ARRAY,
                                            items: {
                                                type: Type.OBJECT,
                                                properties: {
                                                    type: { type: Type.STRING, enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK"] },
                                                    question: { type: Type.STRING },
                                                    options: {
                                                        type: Type.ARRAY,
                                                        items: {
                                                            type: Type.OBJECT,
                                                            properties: {
                                                                id: { type: Type.STRING },
                                                                text: { type: Type.STRING }
                                                            },
                                                            required: ["id", "text"]
                                                        }
                                                    },
                                                    correctAnswer: { type: Type.STRING },
                                                    explanation: { type: Type.STRING }
                                                },
                                                required: ["type", "question", "correctAnswer", "explanation"]
                                            }
                                        }
                                    },
                                    required: ["title", "challenges"]
                                }
                            }
                        },
                        required: ["title", "description", "lessons"]
                    }
                }
            };

            // Only add maxOutputTokens if explicitly set > 0
            if (config.maxOutputTokens && config.maxOutputTokens > 0) {
                genConfig.maxOutputTokens = config.maxOutputTokens;
            }

            const response = await ai.models.generateContent({
                model: config.textModel,
                contents: { parts: [{ text }] },
                config: genConfig
            });

            if (response.text) {
                return JSON.parse(response.text);
            }
        }
    } catch (err) {
        console.error("Structured Gen Error", err);
        throw err;
    }
    return [];
};


// --- Logic Helpers ---

export const checkDuplicate = (newText: string, items: KnowledgeItem[]): KnowledgeItem | null => {
    if (!newText || newText.length < 10) return null;
    if (!items || items.length === 0) return null;

    const cleanNew = newText.replace(/\s/g, '');
    
    for (const item of items) {
        if (item.type !== 'text') continue;
        const cleanOld = item.content.replace(/\s/g, '');
        
        // Check if one contains the other (substantial overlap)
        if (cleanNew.includes(cleanOld) && cleanOld.length > 20) return item;
        if (cleanOld.includes(cleanNew) && cleanNew.length > 20) return item;
        
        // Check similarity by comparing first 20 chars (simple header match)
        if (cleanNew.slice(0, 20) === cleanOld.slice(0, 20)) return item;
    }
    return null;
};
