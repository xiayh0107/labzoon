
export enum QuestionType {
  SINGLE_CHOICE = 'SINGLE_CHOICE',
  MULTIPLE_CHOICE = 'MULTIPLE_CHOICE',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_BLANK = 'FILL_BLANK'
}

export interface Option {
  id: string;
  text: string;
}

export interface Challenge {
  id: string;
  type: QuestionType;
  question: string;
  imageUrl?: string; // Optional image for the question
  options?: Option[]; // For multiple choice
  correctAnswer: string; // The ID of the correct option or the text string
  explanation: string; // Shown after answering
}

export interface Lesson {
  id: string;
  title: string;
  challenges: Challenge[];
  completed: boolean;
  locked: boolean;
  stars: number; // 0-3
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  color: string; // Tailwind color class helper (e.g., "green", "blue")
  lessons: Lesson[];
}

export interface UserProgress {
  hearts: number;
  xp: number;
  streak: number;
  completedLessonIds: string[];
  email?: string; // Added for leaderboard display
  username?: string; // Optional nickname
  lastActive?: number;
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string; // Text content or Image description/context
  type: 'text' | 'image';
  imageData?: string; // Base64 if image for preview
  createdAt: number;
}

export interface AIConfiguration {
  provider: 'google' | 'openai';
  baseUrl?: string;
  apiKey: string;
  textModel: string;
  imageModel: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  // Prompts
  systemPromptText: string;
  systemPromptImage: string;
  systemPromptStructure: string;
}
