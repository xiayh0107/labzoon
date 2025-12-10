import React, { useState, useEffect } from 'react';
import { 
  Database, Download, Upload, Clock, AlertTriangle, 
  CheckCircle2, Loader2, RefreshCw, Trash2, Eye,
  ChevronDown, ChevronUp, History, Archive
} from 'lucide-react';
import { apiClientV2, SnapshotSummary, SnapshotDetail } from '../apiClient';

interface DataBackupPanelProps {
  onRefreshData?: () => void;
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const snapshotTypeLabels: Record<string, { label: string; color: string }> = {
  'manual': { label: '手动备份', color: 'blue' },
  'auto': { label: '自动备份', color: 'gray' },
  'before_update': { label: '更新前', color: 'yellow' },
  'before_delete': { label: '删除前', color: 'orange' },
  'before_restore': { label: '恢复前', color: 'purple' },
  'migration_backup': { label: '迁移备份', color: 'green' },
  'migration_complete': { label: '迁移完成', color: 'green' }
};

export default function DataBackupPanel({ onRefreshData }: DataBackupPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [snapshotDetail, setSnapshotDetail] = useState<SnapshotDetail | null>(null);
  const [backupDescription, setBackupDescription] = useState('');
  const [showConfirmRestore, setShowConfirmRestore] = useState<number | null>(null);

  // 加载快照列表
  const loadSnapshots = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClientV2.fetchSnapshots(30);
      setSnapshots(data);
    } catch (err: any) {
      setError(err.message || '加载快照列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  // 创建手动备份
  const handleCreateBackup = async () => {
    try {
      setCreating(true);
      setError(null);
      await apiClientV2.createSnapshot(backupDescription || '手动备份');
      setSuccess('备份创建成功！');
      setBackupDescription('');
      await loadSnapshots();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || '创建备份失败');
    } finally {
      setCreating(false);
    }
  };

  // 查看快照详情
  const handleViewDetail = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setSnapshotDetail(null);
      return;
    }

    try {
      const detail = await apiClientV2.fetchSnapshotDetail(id);
      setSnapshotDetail(detail);
      setExpandedId(id);
    } catch (err: any) {
      setError(err.message || '加载快照详情失败');
    }
  };

  // 恢复快照
  const handleRestore = async (id: number) => {
    try {
      setRestoring(id);
      setError(null);
      setShowConfirmRestore(null);
      
      const result = await apiClientV2.restoreSnapshot(id);
      setSuccess(`恢复成功！已恢复 ${result.units} 个单元、${result.lessons} 个课程、${result.challenges} 道题目`);
      
      // 刷新父组件数据
      if (onRefreshData) {
        onRefreshData();
      }
      
      await loadSnapshots();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err: any) {
      setError(err.message || '恢复失败');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="text-purple-500" size={24} />
            <div>
              <h2 className="font-bold text-gray-800">数据备份与恢复</h2>
              <p className="text-xs text-gray-500">管理数据快照，防止数据丢失</p>
            </div>
          </div>
          <button
            onClick={loadSnapshots}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
            title="刷新"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 消息提示 */}
      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {success && (
        <div className="m-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700 text-sm">
          <CheckCircle2 size={16} />
          {success}
        </div>
      )}

      {/* 创建备份区域 */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={backupDescription}
            onChange={(e) => setBackupDescription(e.target.value)}
            placeholder="备份描述（可选）"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleCreateBackup}
            disabled={creating}
            className="px-4 py-2 bg-purple-500 text-white font-medium rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Archive size={16} />
            )}
            创建备份
          </button>
        </div>
      </div>

      {/* 快照列表 */}
      <div className="max-h-[500px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <History size={32} className="mb-2" />
            <p className="text-sm">暂无备份记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {snapshots.map((snapshot) => {
              const typeConfig = snapshotTypeLabels[snapshot.snapshot_type] || { label: snapshot.snapshot_type, color: 'gray' };
              const isExpanded = expandedId === snapshot.id;
              
              return (
                <div key={snapshot.id} className="hover:bg-gray-50 transition-colors">
                  {/* 快照行 */}
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full bg-${typeConfig.color}-100 text-${typeConfig.color}-700`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {snapshot.description || '无描述'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(snapshot.created_at)}
                        </span>
                        <span>操作者: {snapshot.created_by}</span>
                      </div>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewDetail(snapshot.id)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="查看详情"
                      >
                        {isExpanded ? <ChevronUp size={18} /> : <Eye size={18} />}
                      </button>
                      <button
                        onClick={() => setShowConfirmRestore(snapshot.id)}
                        disabled={restoring === snapshot.id}
                        className="px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {restoring === snapshot.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Upload size={14} />
                        )}
                        恢复
                      </button>
                    </div>
                  </div>

                  {/* 展开的详情 */}
                  {isExpanded && snapshotDetail && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="text-gray-500 text-xs mb-1">单元数</div>
                          <div className="text-xl font-bold text-blue-600">
                            {snapshotDetail.data?.units?.length || 0}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="text-gray-500 text-xs mb-1">课程数</div>
                          <div className="text-xl font-bold text-green-600">
                            {snapshotDetail.data?.lessons?.length || 0}
                          </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                          <div className="text-gray-500 text-xs mb-1">题目数</div>
                          <div className="text-xl font-bold text-purple-600">
                            {snapshotDetail.data?.challenges?.length || 0}
                          </div>
                        </div>
                      </div>
                      
                      {/* 单元列表预览 */}
                      {snapshotDetail.data?.units && snapshotDetail.data.units.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs text-gray-500 mb-2">单元列表:</div>
                          <div className="flex flex-wrap gap-2">
                            {snapshotDetail.data.units.slice(0, 5).map((unit: any) => (
                              <span key={unit.id} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs text-gray-600">
                                {unit.title}
                              </span>
                            ))}
                            {snapshotDetail.data.units.length > 5 && (
                              <span className="px-2 py-1 text-xs text-gray-400">
                                +{snapshotDetail.data.units.length - 5} 更多
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 确认恢复对话框 */}
                  {showConfirmRestore === snapshot.id && (
                    <div className="px-4 pb-4 pt-2 bg-yellow-50 border-t border-yellow-200">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-yellow-800 mb-1">
                            确定要恢复到此快照吗？
                          </p>
                          <p className="text-xs text-yellow-700 mb-3">
                            当前数据将被此快照的数据替换。恢复前会自动创建当前状态的备份。
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowConfirmRestore(null)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                              取消
                            </button>
                            <button
                              onClick={() => handleRestore(snapshot.id)}
                              className="px-3 py-1.5 text-xs font-medium text-white bg-yellow-500 rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                              确认恢复
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center">
        系统自动保留最近 50 个快照 • 重要操作前会自动创建备份
      </div>
    </div>
  );
}
