
import React, { useState } from 'react';
import { Library, Search, Database, Trash2, AlertTriangle } from 'lucide-react';
import { KnowledgeItem } from '../types';

interface AdminLibraryProps {
    knowledgeBase: KnowledgeItem[];
    setKnowledgeBase: React.Dispatch<React.SetStateAction<KnowledgeItem[]>>;
    onUseItem: (item: KnowledgeItem) => void;
    onKnowledgeBaseAction?: (action: 'add' | 'delete' | 'set', item?: KnowledgeItem) => void;
}

export default function AdminLibrary({ knowledgeBase, setKnowledgeBase, onUseItem, onKnowledgeBaseAction }: AdminLibraryProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; item: KnowledgeItem | null }>({ isOpen: false, item: null });

    const handleDeleteClick = (e: React.MouseEvent, item: KnowledgeItem) => {
        e.stopPropagation(); // Stop event bubbling
        setDeleteModal({ isOpen: true, item });
    };

    const confirmDelete = () => {
        if (deleteModal.item) {
            if (onKnowledgeBaseAction) {
                onKnowledgeBaseAction('delete', deleteModal.item);
            } else {
                setKnowledgeBase(prev => prev.filter(k => k.id !== deleteModal.item!.id));
            }
        }
        setDeleteModal({ isOpen: false, item: null });
    };

    return (
        <div className="bg-white p-6 rounded-2xl border-2 border-gray-200 shadow-sm min-h-[500px] relative">
            
            {/* Custom Delete Confirmation Modal */}
            {deleteModal.isOpen && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-2xl animate-in fade-in duration-200">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-sm w-full mx-4 border border-gray-100 transform scale-100 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-2 mb-2 text-red-500">
                            <AlertTriangle size={24} />
                            <h3 className="text-lg font-bold text-gray-800">确认删除？</h3>
                        </div>
                        <p className="text-gray-600 mb-6 text-sm">
                            确定要删除知识点 "<span className="font-bold">{deleteModal.item?.title}</span>" 吗？<br/>
                            此操作无法撤销。
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button 
                                onClick={() => setDeleteModal({ isOpen: false, item: null })} 
                                className="px-4 py-2 rounded-lg text-sm font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                                取消
                            </button>
                            <button 
                                onClick={confirmDelete} 
                                className="px-4 py-2 rounded-lg text-sm font-bold bg-red-500 text-white hover:bg-red-600 transition-colors shadow-lg"
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex gap-4 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20}/>
                    <input 
                    type="text" 
                    placeholder="搜索知识点..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 p-3 bg-white border-2 border-gray-200 rounded-xl focus:border-purple-500 outline-none text-gray-900 placeholder-gray-400"
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Database size={16} /> 
                    共存储 {knowledgeBase.length} 条记录
                </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {knowledgeBase.length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-400">
                        <Library size={64} className="mx-auto mb-4 opacity-20" />
                        <p>知识库为空，请先在“题目生成”页面上传内容。</p>
                    </div>
                )}
                {knowledgeBase
                .filter(k => k.title.includes(searchQuery) || k.content.includes(searchQuery))
                .map(item => (
                    <div key={item.id} className="border-2 border-gray-100 rounded-xl p-4 hover:border-purple-200 transition-all group flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] px-2 py-1 rounded font-bold uppercase ${item.type === 'text' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                                {item.type}
                            </span>
                            <span className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-gray-800 mb-2 truncate">{item.title}</h4>
                        <div className="flex-1 bg-gray-50 rounded p-2 text-xs text-gray-500 mb-4 overflow-hidden h-24 relative">
                            {item.imageData ? (
                                <img src={item.imageData} className="w-full h-full object-cover rounded" alt="preview" />
                            ) : (
                                <p className="line-clamp-4">{item.content}</p>
                            )}
                        </div>
                        <div className="flex gap-2 mt-auto">
                            <button 
                            onClick={() => onUseItem(item)}
                            className="flex-1 bg-purple-100 text-purple-700 py-2 rounded-lg text-xs font-bold hover:bg-purple-200"
                            >
                                生成题目
                            </button>
                            <button 
                            onClick={(e) => handleDeleteClick(e, item)}
                            className="px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors"
                            title="删除"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
