import { Unit, QuestionType } from './types';

const COLORS = ['green', 'blue', 'purple', 'orange', 'rose', 'yellow', 'teal', 'indigo'];

const CHAPTERS = [
  "第零章 四次实验课中的某一个实验",
  "第一章 绪论",
  "第二章 实验动物的微生物控制",
  "第三章 实验动物环境与设施控制",
  "第四章 实验动物遗传学及其质量控制",
  "第五章 常用实验动物特性",
  "第六章 实验动物的福利",
  "第七章 免疫缺陷动物",
  "第八章 动物实验设计",
  "第九章 实验动物饲料营养标准化",
  "第十章 人类疾病动物模型",
  "第十一章 遗传工程动物"
];

export const INITIAL_UNITS: Unit[] = CHAPTERS.map((title, index) => ({
  id: `unit-${index}`,
  title: title,
  description: index === 0 ? '实验操作基础入门' : '点击进入本章学习',
  color: COLORS[index % COLORS.length],
  lessons: [
    // Add a default empty lesson for structure, except for the first one maybe having content
    {
      id: `lesson-${index}-1`,
      title: '第1节：基础知识',
      completed: false,
      locked: index > 0, // Lock everything except the first chapter
      stars: 0,
      challenges: []
    }
  ]
}));

// Add some sample content to Chapter 1 (Index 1) just so it's not empty
if (INITIAL_UNITS[1]) {
  INITIAL_UNITS[1].lessons[0].challenges = [
    {
      id: 'q1-1',
      type: QuestionType.MULTIPLE_CHOICE,
      question: '“实验动物” (Laboratory Animal) 与一般动物的主要区别是什么？',
      options: [
        { id: 'a', text: '体型更小，食量更少' },
        { id: 'b', text: '经人工培育，遗传背景明确，微生物控制' },
        { id: 'c', text: '必须是从野外直接捕获的' },
      ],
      correctAnswer: 'b',
      explanation: '实验动物是指经人工培育，对其携带的微生物和寄生虫进行控制，遗传背景明确，用于科学研究的动物。'
    }
  ];
}
