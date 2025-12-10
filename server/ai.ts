import express from 'express';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import { taskManager, Task } from './tasks.js';

// Initialize Supabase client for task management
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const router = express.Router();

// --- Types ---
interface AIConfig {
  provider: 'google' | 'openai';
  apiKey: string;
  baseUrl?: string;
  textModel: string;
  imageModel?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
}

// --- Helper: Get server-side default config from environment variables ---
const getServerConfig = (): Partial<AIConfig> => ({
  provider: (process.env.VITE_AI_PROVIDER as 'google' | 'openai') || 'openai',
  apiKey: process.env.VITE_AI_PROVIDER === 'google' 
    ? process.env.VITE_GEMINI_API_KEY || ''
    : process.env.VITE_OPENAI_API_KEY || '',
  baseUrl: process.env.VITE_AI_BASE_URL || '',
  textModel: process.env.VITE_AI_TEXT_MODEL || 'gpt-4',
  imageModel: process.env.VITE_AI_IMAGE_MODEL || '',
  temperature: parseFloat(process.env.VITE_AI_TEMPERATURE || '0.3'),
  topP: parseFloat(process.env.VITE_AI_TOP_P || '0.95'),
  topK: parseInt(process.env.VITE_AI_TOP_K || '40'),
  maxOutputTokens: parseInt(process.env.VITE_AI_MAX_OUTPUT_TOKENS || '32000'),
});

// --- Helper: Merge client config with server defaults (server takes precedence for sensitive fields) ---
const mergeWithServerConfig = (clientConfig: AIConfig): AIConfig => {
  const serverConfig = getServerConfig();
  
  // Use server API key if client's is empty or missing
  const apiKey = clientConfig.apiKey?.trim() || serverConfig.apiKey || '';
  
  return {
    provider: clientConfig.provider || serverConfig.provider || 'openai',
    apiKey,
    baseUrl: clientConfig.baseUrl?.trim() || serverConfig.baseUrl || '',
    textModel: clientConfig.textModel || serverConfig.textModel || 'gpt-4',
    imageModel: clientConfig.imageModel || serverConfig.imageModel,
    temperature: clientConfig.temperature ?? serverConfig.temperature ?? 0.3,
    topP: clientConfig.topP ?? serverConfig.topP ?? 0.95,
    topK: clientConfig.topK ?? serverConfig.topK ?? 40,
    maxOutputTokens: clientConfig.maxOutputTokens ?? serverConfig.maxOutputTokens ?? 32000,
  };
};

// --- Helper: Create AI Provider Instance ---
// Returns a function that creates the appropriate model for the given model ID
const createProvider = (config: AIConfig) => {
  if (config.provider === 'openai') {
    const openai = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
    // Use .chat() to explicitly use Chat Completions API instead of Responses API
    // This is required for third-party OpenAI-compatible APIs (Volcengine, Azure, etc.)
    return (modelId: string) => openai.chat(modelId);
  } else {
    return createGoogleGenerativeAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
  }
};

// --- Helper: Clean JSON Output ---
const cleanJsonOutput = (text: string): string => {
  if (!text) return "";
  let cleaned = text.trim();
  
  // Try to find JSON block in markdown
  const jsonBlockMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/i);
  if (jsonBlockMatch) return jsonBlockMatch[1];
  
  // Try to find generic code block
  const codeBlockMatch = cleaned.match(/```\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) return codeBlockMatch[1];

  // Fallback: Find outermost array or object
  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];
  
  const objectMatch = cleaned.match(/\{[\s\S]*\}/);
  if (objectMatch) return objectMatch[0];

  return cleaned;
};

// --- Helper: Safe JSON Parse with Item Isolation ---
// Attempts to parse JSON, and if it fails, tries to extract valid items
const safeJsonParseWithIsolation = (jsonText: string, itemType: 'questions' | 'units' = 'questions'): { validItems: any[], invalidItems: any[], error?: string } => {
  try {
    // First attempt to parse the entire JSON
    const parsed = JSON.parse(jsonText);
    return { 
      validItems: Array.isArray(parsed) ? parsed : [], 
      invalidItems: [] 
    };
  } catch (error) {
    console.error(`Initial JSON parse failed for ${itemType}:`, error);
    
    // If parsing fails, try to extract individual items
    const validItems: any[] = [];
    const invalidItems: any[] = [];
    
    if (itemType === 'questions') {
      // Try to extract individual question objects
      const questionMatches = jsonText.match(/\{[^{}]*"question"[^{}]*\}/g);
      
      if (questionMatches) {
        questionMatches.forEach((match, idx) => {
          try {
            const question = JSON.parse(match);
            if (question.question) { // Basic validation
              validItems.push({ ...question, id: question.id || `rescued-${Date.now()}-${idx}` });
            }
          } catch (e) {
            // Even if individual parse fails, try to extract at least the question text
            const questionTextMatch = match.match(/"question"\s*:\s*"([^"]*)"/);
            if (questionTextMatch) {
              invalidItems.push({ 
                question: questionTextMatch[1], 
                error: "Parse error",
                rawText: match.substring(0, 200) + (match.length > 200 ? "..." : "")
              });
            }
          }
        });
      }
    } else if (itemType === 'units') {
      // First, try to extract units with more robust pattern
      const unitMatches = jsonText.match(/\{[^{}]*"title"[^{}]*"lessons"[^{}]*\}/g);
      console.log(`Unit extraction - matches count: ${unitMatches?.length || 0}`);
      
      // If no matches, try a more relaxed pattern
      const fallbackMatches = !unitMatches?.length ? jsonText.match(/\{[^{}]*"title"[^{}]*\}/g) : null;
      if (fallbackMatches) {
        console.log(`Unit extraction - fallback matches count: ${fallbackMatches?.length || 0}`);
      }
      
      const matchesToUse = unitMatches?.length ? unitMatches : fallbackMatches;
      
      if (matchesToUse) {
        matchesToUse.forEach((match, idx) => {
          try {
            const unit = JSON.parse(match);
            // More flexible validation - either title or id should exist
            if ((unit.title || unit.id) && (unit.lessons || Array.isArray(unit.lessons))) { 
              validItems.push({ 
                ...unit, 
                id: unit.id || `unit-rescued-${Date.now()}-${idx}`,
                title: unit.title || `单元 ${idx + 1}`, // Provide a default title if missing
                lessons: (unit.lessons || []).map((lesson: any, lessonIdx: number) => ({
                  ...lesson,
                  id: lesson.id || `lesson-rescued-${Date.now()}-${idx}-${lessonIdx}`,
                  title: lesson.title || `小节 ${lessonIdx + 1}`, // Provide a default title if missing
                  challenges: lesson.challenges || []
                }))
              });
            } else {
              console.log(`Unit validation failed:`, { title: unit.title, id: unit.id, lessons: unit.lessons });
            }
          } catch (e) {
            console.error(`Failed to parse unit ${idx}:`, e);
            // Even if individual parse fails, try to extract at least the title
            const titleMatch = match.match(/"title"\s*:\s*"([^"]*)"/);
            if (titleMatch) {
              invalidItems.push({ 
                title: titleMatch[1], 
                error: "Parse error",
                rawText: match.substring(0, 200) + (match.length > 200 ? "..." : "")
              });
            }
          }
        });
      }
    }
    
    return { 
      validItems, 
      invalidItems,
      error: error instanceof Error ? error.message : "Unknown parsing error"
    };
  }
};

// --- Helper: Normalize Questions ---
const normalizeQuestions = (data: any[]): any[] => {
  return data.map((q: any, idx: number) => {
    let options = q.options;
    
    // 确保题目类型有效，默认为SINGLE_CHOICE
    if (!q.type || !['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_BLANK'].includes(q.type)) {
      q.type = 'SINGLE_CHOICE';
    }
    
    // 根据题目类型验证格式
    if (q.type === 'TRUE_FALSE' && (!options || options.length !== 2)) {
      // 确保判断题只有两个选项
      options = [
        { id: "A", text: "正确" },
        { id: "B", text: "错误" }
      ];
    } else if ((q.type === 'SINGLE_CHOICE' || q.type === 'MULTIPLE_CHOICE') && !options) {
      // 单选和多选题必须有选项
      options = [
        { id: "A", text: "选项A" },
        { id: "B", text: "选项B" },
        { id: "C", text: "选项C" },
        { id: "D", text: "选项D" }
      ];
    }
    
    if (Array.isArray(options) && typeof options[0] === 'string') {
      options = options.map((optText: string, optIdx: number) => ({
        id: String.fromCharCode(65 + optIdx),
        text: optText
      }));
    }

    return {
      ...q,
      type: q.type,
      options: options,
      id: q.id || `gen-${Date.now()}-${idx}`
    };
  });
};

// --- Route: POST /api/ai/generate ---
// Generate quiz questions from text content
router.post('/generate', async (req, res) => {
  try {
    const { content, systemPrompt, config: clientConfig, userId, useTask = false, title } = req.body as {
      content: string;
      systemPrompt: string;
      config: AIConfig;
      userId?: string;
      useTask?: boolean;
      title?: string;
    };

    // Merge client config with server defaults
    const config = mergeWithServerConfig(clientConfig || {} as AIConfig);

    if (!content || !config.apiKey) {
      return res.status(400).json({ error: 'Missing required fields (content or API key)' });
    }

    // If using task management, create a task and return immediately
    if (useTask && userId) {
      const inputSummary = content.length > 100 ? content.slice(0, 100) + '...' : content;
      const task = await taskManager.createTask(
        userId, 
        'generate_questions', 
        title || '生成题目',
        inputSummary
      );

      // Run generation in background
      (async () => {
        try {
          await taskManager.updateTask(task.id, { status: 'running', progress: 10 });

          const provider = createProvider(config);
          const model = provider(config.textModel);

          await taskManager.updateTask(task.id, { progress: 30 });

          const result = await generateText({
            model,
            system: systemPrompt,
            prompt: content,
            temperature: config.temperature ?? 0.3,
            topP: config.topP ?? 0.95,
            maxOutputTokens: config.maxOutputTokens ?? 40000,
          });

          await taskManager.updateTask(task.id, { progress: 80 });

          const cleanedJson = cleanJsonOutput(result.text);
          const { validItems, invalidItems } = safeJsonParseWithIsolation(cleanedJson, 'questions');
          
          const normalized = normalizeQuestions(validItems);
          
          await taskManager.updateTask(task.id, { 
            status: 'completed', 
            progress: 100,
            result: {
              questions: normalized,
              rescuedCount: validItems.length,
              invalidCount: invalidItems.length,
              invalidItems: invalidItems.slice(0, 5) // Only include first 5 invalid items to avoid too much data
            }
          });
        } catch (error: any) {
          console.error('Background generate error:', error);
          await taskManager.updateTask(task.id, { 
            status: 'failed', 
            error: error.message || 'Generation failed'
          });
        }
      })();

      return res.json({ 
        success: true, 
        taskId: task.id,
        message: 'Task created, generation started in background'
      });
    }

    // Synchronous generation (original behavior)
    const provider = createProvider(config);
    const model = provider(config.textModel);

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: content,
      temperature: config.temperature ?? 0.3,
      topP: config.topP ?? 0.95,
      maxOutputTokens: config.maxOutputTokens ?? 40000,
    });

    const cleanedJson = cleanJsonOutput(result.text);
    const { validItems, invalidItems, error } = safeJsonParseWithIsolation(cleanedJson, 'questions');
    const normalized = normalizeQuestions(validItems);

    res.json({ 
      success: true, 
      data: normalized,
      rescuedCount: validItems.length,
      invalidCount: invalidItems.length,
      invalidItems: invalidItems.slice(0, 5), // Only include first 5 invalid items
      parseError: error ? error : undefined,
      usage: result.usage 
    });

  } catch (error: any) {
    console.error('AI Generate Error:', error);
    res.status(500).json({ 
      error: error.message || 'AI generation failed',
      details: error.cause?.message
    });
  }
});

// --- Route: POST /api/ai/generate-structure ---
// Generate structured curriculum from text
router.post('/generate-structure', async (req, res) => {
  const { content, systemPrompt, config: clientConfig, taskId, userId, useTask = false, title } = req.body as {
    content: string;
    systemPrompt: string;
    config: AIConfig;
    taskId?: string;
    userId?: string;
    useTask?: boolean;
    title?: string;
  };

  // Merge client config with server defaults
  const config = mergeWithServerConfig(clientConfig || {} as AIConfig);

  if (!content || !config.apiKey) {
    return res.status(400).json({ error: 'Missing required fields (content or API key)' });
  }

  // If using task management, create a task and return immediately
  if (useTask && userId) {
    const inputSummary = content.length > 100 ? content.slice(0, 100) + '...' : content;
    const task = await taskManager.createTask(
      userId, 
      'generate_structure', 
      title || '生成课程结构',
      inputSummary
    );

    // Run generation in background
    (async () => {
      try {
        await taskManager.updateTask(task.id, { status: 'running', progress: 10 });

        const provider = createProvider(config);
        const model = provider(config.textModel);

        await taskManager.updateTask(task.id, { progress: 30 });

        const result = await generateText({
          model,
          system: systemPrompt,
          prompt: content,
          temperature: config.temperature ?? 0.3,
          topP: config.topP ?? 0.95,
          maxOutputTokens: config.maxOutputTokens ?? 40000,
        });

        await taskManager.updateTask(task.id, { progress: 70 });

        const cleanedJson = cleanJsonOutput(result.text);
        console.log('Structure generation - cleaned JSON length:', cleanedJson.length);
        const { validItems, invalidItems } = safeJsonParseWithIsolation(cleanedJson, 'units');
        console.log('Structure generation - validItems count:', validItems.length, 'invalidItems count:', invalidItems.length);
        
        // Debug: Log first 100 chars of cleaned JSON if no valid items found
        if (validItems.length === 0) {
          console.log('No valid units found. Cleaned JSON preview:', cleanedJson.substring(0, 200));
        }
        
        // Normalize questions in each lesson
        const normalizedUnits = validItems.map((unit: any, unitIdx: number) => ({
          ...unit,
          id: unit.id || `unit-gen-${Date.now()}-${unitIdx}`,
          lessons: (unit.lessons || []).map((lesson: any, lessonIdx: number) => ({
            ...lesson,
            id: lesson.id || `lesson-gen-${Date.now()}-${unitIdx}-${lessonIdx}`,
            completed: false,
            locked: lessonIdx > 0,
            stars: 0,
            challenges: normalizeQuestions(lesson.challenges || [])
          }))
        }));

        await taskManager.updateTask(task.id, { 
          status: 'completed', 
          progress: 100,
          result: {
            units: normalizedUnits,
            rescuedCount: validItems.length,
            invalidCount: invalidItems.length
          }
        });
      } catch (error: any) {
        console.error('Background generate-structure error:', error);
        await taskManager.updateTask(task.id, { 
          status: 'failed', 
          error: error.message || 'Structure generation failed'
        });
      }
    })();

    return res.json({ 
      success: true, 
      taskId: task.id,
      message: 'Task created, generation started in background'
    });
  }

  // --- Synchronous execution (original behavior) ---
  
  // Helper to update task status (for legacy taskId parameter)
  const updateTask = async (status: string, output?: any, error?: string) => {
    if (!taskId || !userId) return;
    try {
      const updateData: any = { status };
      if (status === 'running') updateData.started_at = new Date().toISOString();
      if (status === 'completed' || status === 'failed') updateData.completed_at = new Date().toISOString();
      if (output) updateData.output = output;
      if (error) updateData.error = error;
      
      await supabase
        .from('ai_tasks')
        .update(updateData)
        .eq('id', taskId)
        .eq('user_id', userId);
    } catch (e) {
      console.error('Failed to update task:', e);
    }
  };

  try {
    if (!content || !config?.apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Mark task as running
    await updateTask('running');

    const provider = createProvider(config);
    const model = provider(config.textModel);

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: content,
      temperature: config.temperature ?? 0.3,
      topP: config.topP ?? 0.95,
      maxOutputTokens: config.maxOutputTokens ?? 40000,
    });

    const cleanedJson = cleanJsonOutput(result.text);
    const { validItems, invalidItems, error } = safeJsonParseWithIsolation(cleanedJson, 'units');

    // Normalize questions in each lesson
    const normalizedUnits = validItems.map((unit: any, unitIdx: number) => ({
      ...unit,
      id: unit.id || `unit-gen-${Date.now()}-${unitIdx}`,
      lessons: (unit.lessons || []).map((lesson: any, lessonIdx: number) => ({
        ...lesson,
        id: lesson.id || `lesson-gen-${Date.now()}-${unitIdx}-${lessonIdx}`,
        completed: false,
        locked: lessonIdx > 0,
        stars: 0,
        challenges: normalizeQuestions(lesson.challenges || [])
      }))
    }));

    // Mark task as completed
    await updateTask('completed', { 
      unitsCount: normalizedUnits.length,
      rescuedCount: validItems.length,
      invalidCount: invalidItems.length,
      usage: result.usage 
    });

    res.json({ 
      success: true, 
      data: normalizedUnits,
      rescuedCount: validItems.length,
      invalidCount: invalidItems.length,
      invalidItems: invalidItems.slice(0, 3), // Only include first 3 invalid units
      parseError: error ? error : undefined,
      usage: result.usage 
    });

  } catch (error: any) {
    console.error('AI Generate Structure Error:', error);
    
    // Mark task as failed
    await updateTask('failed', null, error.message);
    
    res.status(500).json({ 
      error: error.message || 'Structure generation failed',
      details: error.cause?.message
    });
  }
});

// --- Route: POST /api/ai/stream ---
// Stream text generation (for real-time output)
router.post('/stream', async (req, res) => {
  try {
    const { prompt, systemPrompt, config: clientConfig } = req.body as {
      prompt: string;
      systemPrompt?: string;
      config: AIConfig;
    };

    // Merge client config with server defaults
    const config = mergeWithServerConfig(clientConfig || {} as AIConfig);

    if (!prompt || !config.apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const provider = createProvider(config);
    const model = provider(config.textModel);

    const result = streamText({
      model,
      system: systemPrompt,
      prompt,
      temperature: config.temperature ?? 0.7,
      maxOutputTokens: config.maxOutputTokens ?? 4000,
    });

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response
    for await (const chunk of result.textStream) {
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('AI Stream Error:', error);
    res.status(500).json({ 
      error: error.message || 'Streaming failed' 
    });
  }
});

// --- Route: POST /api/ai/test ---
// Test AI connection
router.post('/test', async (req, res) => {
  try {
    const { config: clientConfig } = req.body as { config: AIConfig };

    // Merge client config with server defaults
    const config = mergeWithServerConfig(clientConfig || {} as AIConfig);

    if (!config.apiKey) {
      return res.status(400).json({ error: 'Missing API key' });
    }

    const provider = createProvider(config);
    const model = provider(config.textModel);

    const result = await generateText({
      model,
      prompt: 'Hello, respond with just "OK"',
      maxOutputTokens: 10,
    });

    res.json({ 
      success: true, 
      message: 'Connection successful',
      response: result.text.trim()
    });

  } catch (error: any) {
    console.error('AI Test Error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Connection test failed'
    });
  }
});

// --- Route: POST /api/ai/generate-options ---
// Generate additional options for a question
router.post('/generate-options', async (req, res) => {
  try {
    const { question, correctAnswer, count, config: clientConfig, systemPrompt } = req.body as {
      question: string;
      correctAnswer: string;
      count: number;
      config: AIConfig;
      systemPrompt?: string;
    };

    // Merge client config with server defaults
    const config = mergeWithServerConfig(clientConfig || {} as AIConfig);

    if (!question || !correctAnswer || !config.apiKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const provider = createProvider(config);
    const model = provider(config.textModel);

    const prompt = `问题: "${question}"
正确答案: "${correctAnswer}"

请为这道选择题生成 ${count || 3} 个具有迷惑性但错误的干扰选项。
要求：
1. 干扰项必须与正确答案在同一领域/类别
2. 干扰项必须看起来合理但实际错误
3. 输出格式必须是纯 JSON 数组：[{"id": "A", "text": "选项1"}, {"id": "B", "text": "选项2"}]。
4. 不要包含任何其他文字。`;

    const result = await generateText({
      model,
      system: systemPrompt || '你是一位医学实验动物学专家，擅长设计具有迷惑性的选择题干扰项。',
      prompt,
      temperature: 0.7,
      maxOutputTokens: 1000,
    });

    const cleanedJson = cleanJsonOutput(result.text);
    const options = JSON.parse(cleanedJson);

    res.json({ 
      success: true, 
      data: Array.isArray(options) ? options : []
    });

  } catch (error: any) {
    console.error('AI Generate Options Error:', error);
    res.status(500).json({ 
      error: error.message || 'Options generation failed'
    });
  }
});

export default router;
