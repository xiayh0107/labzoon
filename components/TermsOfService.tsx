import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function TermsOfService({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6 font-sans">
      <div className="w-full max-w-2xl">
        <button 
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> 返回
        </button>
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">服务条款</h1>
        
        <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
          <p>欢迎使用 LabZoon！在使用我们的服务之前，请仔细阅读以下条款。</p>
          
          <h3 className="text-xl font-bold text-gray-800">1. 服务说明</h3>
          <p>LabZoon 是一个旨在通过游戏化方式教授医学实验动物学知识的在线平台。我们致力于提供高质量的学习内容和互动体验。</p>
          
          <h3 className="text-xl font-bold text-gray-800">2. 用户账号</h3>
          <p>您需要注册账号才能使用 LabZoon 的完整功能。您有责任维护账号信息的安全，并对您账号下的所有活动负责。</p>
          
          <h3 className="text-xl font-bold text-gray-800">3. 内容使用</h3>
          <p>平台上的所有内容（包括但不限于文字、图片、代码）均受版权保护。未经许可，不得用于商业用途。</p>
          
          <h3 className="text-xl font-bold text-gray-800">4. 隐私保护</h3>
          <p>我们重视您的隐私。您的个人信息将仅用于提供和改进我们的服务，不会未经允许透露给第三方。</p>
          
          <h3 className="text-xl font-bold text-gray-800">5. 免责声明</h3>
          <p>虽然我们努力确保内容的准确性，但 LabZoon 不对因使用本平台内容而产生的任何直接或间接损失负责。医学知识更新迅速，请以最新权威教材为准。</p>
        </div>
      </div>
    </div>
  );
}
