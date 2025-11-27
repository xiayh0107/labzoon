import React from 'react';
import { BookOpen, Lock, Check, Zap } from 'lucide-react';
import { Unit } from '../types';

interface UnitPathProps {
    units: Unit[];
    onStartLesson: (unitId: string, lessonId: string) => void;
}

export default function UnitPath({ units, onStartLesson }: UnitPathProps) {
  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto pb-24 md:pb-0">
      {units.map((unit) => (
        <div key={unit.id} className="w-full mb-8">
          <div className={`w-full p-4 mb-6 rounded-2xl text-white shadow-md flex justify-between items-center bg-${unit.color}-500`}>
            <div>
              <h2 className="text-xl font-bold">{unit.title}</h2>
              <p className="text-sm opacity-90">{unit.description}</p>
            </div>
            <BookOpen className="opacity-50" />
          </div>
          
          <div className="flex flex-col items-center gap-6">
            {unit.lessons.map((lesson, idx) => {
              // Stagger effect for visual path
              const offset = idx % 2 === 0 ? '0px' : (idx % 4 === 1 ? '40px' : '-40px');
              
              return (
                <div key={lesson.id} style={{ transform: `translateX(${offset})` }} className="relative group">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gray-200 rounded-full -z-10" />
                  <button
                    onClick={() => !lesson.locked && onStartLesson(unit.id, lesson.id)}
                    disabled={lesson.locked}
                    className={`w-16 h-16 rounded-full flex items-center justify-center border-b-4 transition-all active:border-b-0 active:translate-y-1 
                      ${lesson.locked 
                        ? 'bg-gray-300 border-gray-400 text-gray-500 cursor-not-allowed' 
                        : lesson.completed 
                          ? 'bg-yellow-400 border-yellow-600 text-white' 
                          : `bg-${unit.color}-500 border-${unit.color}-700 text-white`
                      }
                    `}
                  >
                    {lesson.locked ? <Lock size={24} /> : lesson.completed ? <Check size={32} strokeWidth={4} /> : <Zap size={32} fill="currentColor" />}
                  </button>
                  {/* Tooltip for lesson title */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white border-2 border-gray-200 px-3 py-1 rounded-lg text-sm font-bold text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    {lesson.title}
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t-2 border-l-2 border-gray-200 rotate-45"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
