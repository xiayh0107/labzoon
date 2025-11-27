import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export default function EthicsGuidelines({ onBack }: Props) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6 font-sans">
      <div className="w-full max-w-2xl">
        <button 
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-gray-500 hover:text-gray-800 font-bold transition-colors"
        >
          <ArrowLeft size={20} /> 返回
        </button>
        
        <h1 className="text-3xl font-extrabold text-gray-900 mb-6">实验动物伦理准则</h1>
        
        <div className="prose prose-gray max-w-none text-gray-600 space-y-4">
          <p>在 LabZoon，我们不仅教授实验技术，更强调对生命的尊重。所有涉及实验动物的活动都必须遵循严格的伦理准则。</p>
          
          <h3 className="text-xl font-bold text-gray-800">1. 3R 原则</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>替代 (Replacement)：</strong> 尽可能使用非动物方法（如计算机模拟、细胞培养）替代动物实验。</li>
            <li><strong>减少 (Reduction)：</strong> 在保证实验结果科学性的前提下，使用最少数量的动物。</li>
            <li><strong>优化 (Refinement)：</strong> 改进实验程序，减轻动物的痛苦和应激，提高动物福利。</li>
          </ul>
          
          <h3 className="text-xl font-bold text-gray-800">2. 动物福利</h3>
          <p>必须为实验动物提供适宜的饲养环境、充足的营养和必要的兽医护理。任何造成动物痛苦的操作都应采取麻醉或镇痛措施。</p>
          
          <h3 className="text-xl font-bold text-gray-800">3. 尊重生命</h3>
          <p>实验动物为医学进步做出了巨大贡献。我们应当怀着感恩和敬畏之心对待每一个生命，严禁虐待或随意遗弃实验动物。</p>
          
          <h3 className="text-xl font-bold text-gray-800">4. 虚拟实验伦理</h3>
          <p>即使在虚拟环境中，我们也鼓励用户保持严肃、专业的态度。LabZoon 的模拟实验旨在培养正确的操作规范和伦理意识。</p>
        </div>
      </div>
    </div>
  );
}
