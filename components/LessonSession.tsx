
import React, { useState, useMemo, useEffect } from 'react';
import { BookOpen, X, Check, Award, RefreshCcw, AlertTriangle, Heart } from 'lucide-react';
import { Lesson, QuestionType, Challenge } from '../types';

interface LessonSessionProps {
    lesson: Lesson;
    onComplete: () => void;
    onExit: (skipConfirm?: boolean) => void;
}

// Extend Challenge locally to track retries
interface SessionChallenge extends Challenge {
    isRetry?: boolean;
}

// --- Sound Effects Utility (Synthesized for reliability) ---
const playFeedbackSound = (type: 'correct' | 'wrong' | 'complete') => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playTone = (freq: number, type: OscillatorType, duration: number, startTime: number, vol: number = 0.1) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, startTime);
            
            gain.gain.setValueAtTime(vol, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + duration);
        };

        const now = ctx.currentTime;

        if (type === 'correct') {
            // Pleasant "Ding" - Major 3rd interval
            playTone(523.25, 'sine', 0.3, now, 0.1); // C5
            playTone(659.25, 'sine', 0.6, now + 0.1, 0.1); // E5
        } else if (type === 'wrong') {
            // Soft "Thud" - Descending low tone
            playTone(200, 'triangle', 0.3, now, 0.15);
            playTone(150, 'triangle', 0.4, now + 0.1, 0.15);
        } else if (type === 'complete') {
            // Victory Fanfare - C Major Arpeggio
            playTone(523.25, 'square', 0.2, now, 0.05);       // C5
            playTone(659.25, 'square', 0.2, now + 0.15, 0.05); // E5
            playTone(783.99, 'square', 0.2, now + 0.30, 0.05); // G5
            playTone(1046.50, 'square', 0.8, now + 0.45, 0.05);// C6
        }
    } catch (e) {
        console.error("Audio play failed", e);
    }
};

export default function LessonSession({ lesson, onComplete, onExit }: LessonSessionProps) {
  // Initialize queue with lesson challenges
  const [challengesQueue, setChallengesQueue] = useState<SessionChallenge[]>(lesson.challenges);
  const [currentChallengeIndex, setCurrentChallengeIndex] = useState(0);
  
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // State for Fill-in-the-blank (array for multiple blanks)
  const [textInputs, setTextInputs] = useState<string[]>([]);
  
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [completed, setCompleted] = useState(false);

  // Guard clause for empty lessons
  const challenge = challengesQueue?.[currentChallengeIndex];

  // Parse Correct Answer for Fill-in-the-blank (supports "5||7" format)
  const correctBlanks = useMemo(() => {
      if (!challenge || challenge.type !== QuestionType.FILL_BLANK) return [];
      return challenge.correctAnswer.split('||').map(s => s.trim());
  }, [challenge]);

  // Reset inputs when challenge changes
  useEffect(() => {
      if (challenge && challenge.type === QuestionType.FILL_BLANK) {
          setTextInputs(new Array(correctBlanks.length).fill(''));
      } else {
          setTextInputs([]);
      }
      setSelectedOption(null);
      setStatus('idle');
  }, [challenge, correctBlanks.length]);

  // Calculate effective options (handling missing T/F options fallback)
  const effectiveOptions = useMemo(() => {
    if (!challenge) return [];
    // If options exist, use them
    if (challenge.options && challenge.options.length > 0) return challenge.options;
    
    // Fallback: If True/False type but no options generated
    if (challenge.type === QuestionType.TRUE_FALSE) {
        return [
            { id: 'A', text: '正确' },
            { id: 'B', text: '错误' }
        ];
    }
    return [];
  }, [challenge]);

  if (!challenge) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white p-4 text-center">
        <BookOpen size={64} className="text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 mb-2">本节暂无题目</h2>
        <p className="text-gray-500 mb-8">管理员正在努力生成内容中...</p>
        <button 
            onClick={() => onExit(true)}
            className="bg-green-500 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-600 transition shadow-lg border-b-4 border-green-600 active:border-b-0 active:translate-y-1"
        >
            返回首页
        </button>
      </div>
    );
  }

  // Progress is dynamic based on the growing queue
  const progress = (currentChallengeIndex / challengesQueue.length) * 100;

  const checkAnswer = () => {
    let isCorrect = false;

    if (challenge.type === QuestionType.MULTIPLE_CHOICE || challenge.type === QuestionType.TRUE_FALSE) {
      // Robust comparison logic
      const userSelId = String(selectedOption || '').trim().toLowerCase();
      const correctValRaw = String(challenge.correctAnswer || '').trim().toLowerCase();
      
      // Find the selected option object
      const selectedOptionObj = effectiveOptions.find(o => String(o.id).trim().toLowerCase() === userSelId);
      const selectedText = selectedOptionObj ? selectedOptionObj.text.trim().toLowerCase() : '';

      // Logic 1: Direct ID match (e.g. "a" === "a")
      if (userSelId === correctValRaw) {
        isCorrect = true;
      } 
      // Logic 2: Text content match (e.g. "正确" === "正确")
      else if (selectedText === correctValRaw) {
         isCorrect = true;
      }
      // Logic 3: Semantic Boolean Match (Crucial for "False" vs "错误")
      else if (challenge.type === QuestionType.TRUE_FALSE) {
         const trueSynonyms = ['true', 'yes', 't', '正确', '对', '是'];
         const falseSynonyms = ['false', 'no', 'f', '错误', '错', '否'];

         // Check if Correct Answer implies TRUE
         const ansIsTrue = trueSynonyms.includes(correctValRaw);
         // Check if Correct Answer implies FALSE
         const ansIsFalse = falseSynonyms.includes(correctValRaw);

         // Check if User Selection implies TRUE (either by ID 'A' or Text '正确')
         const selIsTrue = selectedText.includes('正确') || selectedText.includes('对') || userSelId === 'a';
         // Check if User Selection implies FALSE (either by ID 'B' or Text '错误')
         const selIsFalse = selectedText.includes('错误') || selectedText.includes('错') || userSelId === 'b';

         if (ansIsTrue && selIsTrue) isCorrect = true;
         if (ansIsFalse && selIsFalse) isCorrect = true;
      }

    } else if (challenge.type === QuestionType.FILL_BLANK) {
       // Check all blanks
       isCorrect = true;
       if (textInputs.length !== correctBlanks.length) {
           isCorrect = false;
       } else {
           for (let i = 0; i < correctBlanks.length; i++) {
               const userVal = (textInputs[i] || '').trim().toLowerCase();
               const correctVal = correctBlanks[i].toLowerCase();
               if (userVal !== correctVal) {
                   isCorrect = false;
                   break;
               }
           }
       }
    }

    if (isCorrect) {
      setStatus('correct');
      playFeedbackSound('correct');
    } else {
      setStatus('wrong');
      playFeedbackSound('wrong');
    }
  };

  const handleNext = () => {
    // If wrong, append the current challenge to the end of the queue for review
    if (status === 'wrong') {
        setChallengesQueue(prev => [
            ...prev, 
            { ...challenge, isRetry: true } // Mark as retry
        ]);
    }

    if (currentChallengeIndex < challengesQueue.length - 1) {
      setCurrentChallengeIndex(prev => prev + 1);
      // Status reset handled in useEffect
    } else {
      setCompleted(true);
      playFeedbackSound('complete');
      setTimeout(() => {
        onComplete();
      }, 2000); // Slightly longer delay to enjoy the victory sound
    }
  };

  const handleBlankChange = (idx: number, val: string) => {
      const newInputs = [...textInputs];
      newInputs[idx] = val;
      setTextInputs(newInputs);
  };

  if (completed) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-yellow-400 text-white animate-fade-in">
        <Award size={120} className="mb-6 animate-bounce" />
        <h1 className="text-4xl font-extrabold mb-8">课程完成!</h1>
        <div className="flex gap-8">
            <div className="bg-yellow-500/50 p-6 rounded-2xl flex flex-col items-center min-w-[120px]">
                <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">获得经验</span>
                <span className="text-4xl font-extrabold flex items-center gap-2">
                    <span className="text-3xl">⚡</span> 10
                </span>
            </div>
            <div className="bg-yellow-500/50 p-6 rounded-2xl flex flex-col items-center min-w-[120px]">
                <span className="text-sm font-bold uppercase tracking-widest opacity-80 mb-2">获得红心</span>
                <span className="text-4xl font-extrabold flex items-center gap-2">
                    <Heart fill="currentColor" className="text-rose-500" /> 1
                </span>
            </div>
        </div>
      </div>
    );
  }

  // Determine button disabled state
  const isCheckDisabled = () => {
      if (status !== 'idle') return false; // "Continue" button is rarely disabled
      if (challenge.type === QuestionType.FILL_BLANK) {
          // Disable if any input is empty
          return textInputs.some(t => !t.trim());
      }
      return !selectedOption;
  };

  // Determine correct answer display string
  const getCorrectAnswerDisplay = () => {
      if (challenge.type === QuestionType.FILL_BLANK) {
          return correctBlanks.join(', ');
      }
      const option = effectiveOptions.find(o => o.id === challenge.correctAnswer || o.text === challenge.correctAnswer);
      return option?.text || challenge.correctAnswer;
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 flex items-center gap-4">
        <button onClick={() => onExit(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
        <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${progress}%` }}></div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center max-w-2xl mx-auto w-full">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-700 mb-8 w-full text-left flex items-center gap-3">
          {challenge.isRetry && (
              <span className="text-xs md:text-sm bg-orange-100 text-orange-600 px-3 py-1 rounded-full flex items-center gap-1">
                  <RefreshCcw size={14} /> 错题重练
              </span>
          )}
          <span>{challenge.type === QuestionType.FILL_BLANK ? '填空题' : '选择正确的答案'}</span>
        </h2>
        
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-100 shadow-sm w-full mb-8">
            {challenge.imageUrl && (
                <div className="w-full h-48 md:h-64 mb-4 bg-gray-50 rounded-xl overflow-hidden border border-gray-200">
                    <img src={challenge.imageUrl} alt="Question" className="w-full h-full object-contain" />
                </div>
            )}
            <p className="text-lg md:text-xl text-gray-800 leading-relaxed font-medium">
                {challenge.question}
            </p>
        </div>

        {/* Options / Inputs Area */}
        <div className="w-full space-y-4">
          {(challenge.type === QuestionType.MULTIPLE_CHOICE || challenge.type === QuestionType.TRUE_FALSE) && (
              effectiveOptions.length === 0 ? (
                  <div className="w-full p-6 bg-red-50 rounded-xl border border-red-200 flex flex-col items-center text-red-500 gap-2">
                      <AlertTriangle size={32} />
                      <p className="font-bold">❌ 题目数据异常：选项缺失</p>
                      <p className="text-sm">无法加载此题的选项。请尝试跳过或联系管理员。</p>
                      <button onClick={handleNext} className="mt-2 text-sm underline hover:text-red-700">跳过此题 (模拟正确)</button>
                  </div>
              ) : (
                effectiveOptions.map((opt, idx) => (
                    <button
                    key={`${opt.id}-${idx}`}
                    onClick={() => status === 'idle' && setSelectedOption(opt.id)}
                    disabled={status !== 'idle'}
                    className={`w-full p-4 rounded-xl border-2 border-b-4 text-left font-bold transition-all
                        ${selectedOption === opt.id 
                        ? 'bg-blue-100 border-blue-500 text-blue-600' 
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }
                        ${status === 'correct' && selectedOption === opt.id ? '!bg-green-100 !border-green-500 !text-green-700' : ''}
                        ${status === 'wrong' && selectedOption === opt.id ? '!bg-red-100 !border-red-500 !text-red-700' : ''}
                    `}
                    >
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 flex items-center justify-center border-2 rounded-lg text-xs opacity-50">{opt.id.toUpperCase()}</span>
                        {opt.text}
                    </div>
                    </button>
                ))
              )
          )}

          {challenge.type === QuestionType.FILL_BLANK && (
            <div className="space-y-4">
                {correctBlanks.map((_, index) => (
                    <div key={index} className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">
                            {index + 1}.
                        </span>
                        <input
                            type="text"
                            value={textInputs[index] || ''}
                            onChange={(e) => handleBlankChange(index, e.target.value)}
                            disabled={status !== 'idle'}
                            placeholder={correctBlanks.length > 1 ? `第 ${index + 1} 个空的答案...` : "在此输入答案..."}
                            className={`w-full pl-10 pr-4 py-4 text-xl border-2 rounded-xl focus:outline-none bg-white font-bold placeholder-gray-400
                                ${status === 'correct' ? 'border-green-500 text-green-700 bg-green-50' : ''}
                                ${status === 'wrong' ? 'border-red-500 text-red-700 bg-red-50' : ''}
                                ${status === 'idle' ? 'border-gray-300 focus:border-blue-500 text-gray-900' : ''}
                            `}
                        />
                    </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer Area */}
      <div className={`p-4 border-t-2 ${status === 'correct' ? 'bg-green-100 border-green-200' : status === 'wrong' ? 'bg-red-100 border-red-200' : 'bg-white border-gray-200'}`}>
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          
          {status === 'correct' && (
            <div className="flex items-center gap-2 text-green-700 font-bold">
              <Check className="w-8 h-8 bg-green-500 text-white rounded-full p-1" />
              <div className="flex flex-col">
                <span>太棒了！</span>
                <span className="text-sm font-normal text-green-800">{challenge.explanation}</span>
              </div>
            </div>
          )}
          
          {status === 'wrong' && (
             <div className="flex items-center gap-2 text-red-700 font-bold">
             <X className="w-8 h-8 bg-red-500 text-white rounded-full p-1" />
             <div className="flex flex-col">
               <span>回答错误</span>
               <span className="text-sm font-normal text-red-800">正确答案: {getCorrectAnswerDisplay()}</span>
               <span className="text-sm font-normal text-red-800 mt-1">{challenge.explanation}</span>
             </div>
           </div>
          )}

          <button
            onClick={status === 'idle' ? checkAnswer : handleNext}
            disabled={isCheckDisabled()}
            className={`w-full py-3 rounded-xl font-extrabold text-lg uppercase tracking-wide border-b-4 transition-all active:border-b-0 active:translate-y-1
              ${status === 'idle' 
                ? 'bg-green-500 border-green-700 text-white hover:bg-green-400 disabled:bg-gray-200 disabled:border-gray-300 disabled:text-gray-400'
                : status === 'correct'
                  ? 'bg-green-600 border-green-800 text-white'
                  : 'bg-red-500 border-red-700 text-white'
              }
            `}
          >
            {status === 'idle' ? '检查' : '继续'}
          </button>
        </div>
      </div>
    </div>
  );
}
