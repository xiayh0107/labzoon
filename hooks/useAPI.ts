import { useState } from 'react';
import { apiClient } from '../apiClient';
import { KnowledgeItem } from '../types';

export const useAPI = (session: any) => {
  const [loading, setLoading] = useState(false);

  const generateKnowledge = async (
    unitTitle: string, 
    lessonTitle: string, 
    difficulty: number, 
    onSuccess: (items: KnowledgeItem[]) => void,
    onError: (error: string) => void
  ) => {
    if (!session) {
      onError('请先登录');
      return;
    }

    setLoading(true);
    try {
      // Generate knowledge using the apiClient
      const knowledgeItems = await apiClient.generateKnowledge({
        unitTitle,
        lessonTitle,
        difficulty,
        userId: session.user.id
      });
      
      onSuccess(knowledgeItems);
    } catch (error: any) {
      console.error('Error generating knowledge:', error);
      onError(error.message || '生成知识点失败');
    } finally {
      setLoading(false);
    }
  };

  const saveKnowledgeToDatabase = async (
    knowledgeItems: KnowledgeItem[],
    lessonId: string,
    onSuccess: () => void,
    onError: (error: string) => void
  ) => {
    if (!session) {
      onError('请先登录');
      return;
    }

    setLoading(true);
    try {
      // Save knowledge items to database via apiClient
      await apiClient.saveKnowledgeItems(knowledgeItems, lessonId, session.user.id);
      onSuccess();
    } catch (error: any) {
      console.error('Error saving knowledge:', error);
      onError(error.message || '保存知识点失败');
    } finally {
      setLoading(false);
    }
  };

  return { 
    loading, 
    generateKnowledge, 
    saveKnowledgeToDatabase 
  };
};