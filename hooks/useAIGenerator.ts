import { generateQuizQuestions, generateStructuredCourseContent, fileToGenerativePart, getAIConfig } from '../api';
import { generateImageForText, fileToBase64, generateOptionsForQuestion } from '../api';
import { apiClient } from '../apiClient';
import { apiClient as apiClientImport } from '../apiClient';
import { userBankApi } from '../apiClient';
import type { Challenge } from '../types';

/**
 * Shared AI generation utilities used by Admin and Personal pages.
 * Exposes functions to run generation either via background tasks (server-side)
 * or directly in the frontend (immediate execution).
 */
export async function submitBackgroundQuestionsTask(userId: string, prompt: string, systemPrompt: string, aiConfig: any, title = '生成题目') {
  return apiClient.createGenerateQuestionsTask(userId, prompt, systemPrompt || '', aiConfig, title);
}

export async function submitBackgroundStructureTask(userId: string, prompt: string, systemPrompt: string, aiConfig: any, title = '智能结构化生成') {
  return apiClient.createGenerateStructureTask(userId, prompt, systemPrompt || '', aiConfig, title);
}

export async function frontendGenerateQuestions(prompt: string, imagePart: any = null, userId?: string): Promise<Challenge[]> {
  return generateQuizQuestions(prompt, imagePart, userId);
}

export async function frontendGenerateStructure(prompt: string, userId?: string): Promise<any[]> {
  return generateStructuredCourseContent(prompt, userId);
}

export async function fileToGenerative(file: File) {
  return fileToGenerativePart(file);
}

export async function generateImageFromText(prompt: string, answerText?: string, userId?: string) {
  return generateImageForText(prompt, answerText, userId);
}

export async function generateOptions(question: string, type: string = 'SINGLE_CHOICE', userId?: string) {
  return generateOptionsForQuestion(question, type, userId);
}

export async function toBase64(file: File) {
  return fileToBase64(file);
}

export async function fetchAIConfig(userId?: string) {
  return getAIConfig(userId);
}

export async function updateAIConfigWrapper(config: any, userId?: string) {
  // prefer server API when available
  return apiClientImport.updateUserAISettings ? apiClientImport.updateUserAISettings(config) : null;
}

export async function testAIConnectionWrapper(config: any) {
  return apiClientImport.testAIConnection ? apiClientImport.testAIConnection(config) : { success: true };
}

export async function saveTaskResultToUserBank(taskResult: any) {
  if (!taskResult) return;
  let challenges: any[] = [];

  if (taskResult.questions) {
    challenges = taskResult.questions;
  } else if (taskResult.units) {
    // flatten units -> sections -> challenges
    taskResult.units.forEach((unit: any) => {
      (unit.sections || []).forEach((section: any) => {
        if (section.challenges) challenges = challenges.concat(section.challenges);
      });
    });
  } else {
    challenges = Array.isArray(taskResult) ? taskResult : [];
  }

  if (challenges.length === 0) return { saved: 0 };

  const formattedChallenges = challenges.map((ch: any, idx: number) => ({
    id: ch.id || `challenge-${Date.now()}-${idx}`,
    type: ch.type,
    question: ch.question,
    correct_answer: ch.correctAnswer || ch.correct_answer,
    options: ch.options,
    explanation: ch.explanation,
    image_url: ch.imageUrl || ch.image_url
  }));

  // Ensure bank and section
  const banks = await userBankApi.fetchBanks();
  let targetBank = banks.find((b: any) => b.title === 'AI生成');
  if (!targetBank) {
    targetBank = await userBankApi.createBank({ title: 'AI生成', description: '由 AI 生成的题目', color: 'purple', icon: '🧠' });
  }

  const banksWithSections = await userBankApi.fetchBanks();
  const updatedBank = banksWithSections.find((b: any) => b.id === targetBank.id);
  const existingSections = updatedBank?.sections || [];
  let targetSection = existingSections.find((s: any) => s.title === '自动生成');
  if (!targetSection) {
    targetSection = await userBankApi.createSection(targetBank.id, '自动生成');
  }

  if (!targetSection?.id) throw new Error('无法创建章节');

  await userBankApi.createChallengesBatch(targetSection.id, formattedChallenges);
  return { saved: formattedChallenges.length, invalidCount: taskResult.invalidCount || 0 };
}

export default {
  submitBackgroundQuestionsTask,
  submitBackgroundStructureTask,
  frontendGenerateQuestions,
  frontendGenerateStructure,
  fileToGenerative,
  generateImageFromText,
  generateOptions,
  toBase64,
  fetchAIConfig
  , updateAIConfigWrapper
  , testAIConnectionWrapper
  , saveTaskResultToUserBank
};
