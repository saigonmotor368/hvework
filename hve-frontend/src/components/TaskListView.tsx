import React, { useState, useEffect } from 'react';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskItem,
} from '../types';
import { MOCK_TASKS } from '../mockData';
import { ENABLE_MOCK_DATA } from '../config';

interface TaskListViewProps {
  apiBaseUrl: string;
  currentUser: any;
  showToast: (msg: string, type?: 'success' | 'error') => void;
  onOpenCreate: () => void;
  onSelectTask: (task: TaskItem) => void;
}

export const TaskListView: React.FC<TaskListViewProps> = ({
  apiBaseUrl,
  showToast,
  onOpenCreate,
  onSelectTask,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Tab và bộ lọc
  const [activeTab, setActiveTab] = useState<
    'all' | 'assigned_to_me' | 'assigned_by_me' | 'department'
  >('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [isOverdueOnly, setIsOverdueOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Expandable subtasks state
  const [expandedTaskIds, setExpandedTaskIds] = useState<number[]>([]);

  const fetchTasks = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      setTasks(ENABLE_MOCK_DATA ? MOCK_TASKS : []);
      return;
    }

    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.append('tab', activeTab);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (isOverdueOnly) params.append('isOverdue', 'true');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await fetch(`${apiBaseUrl}/tasks?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải danh sách công việc');
      const data: TaskItem[] = await res.json();
      setTasks(data);
    } catch (error: any) {
      if (!ENABLE_MOCK_DATA) {
        setTasks([]);
        showToast(error.message || 'Không thể tải danh sách công việc', 'error');
        return;
      }
      let filtered = [...MOCK_TASKS];
      if (statusFilter !== 'all') filtered = filtered.filter((t) => t.status === statusFilter);
      if (priorityFilter !== 'all') filtered = filtered.filter((t) => t.priority === priorityFilter);
      if (isOverdueOnly) filtered = filtered.filter((t) => t.isOverdue);
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        filtered = filtered.filter((t) => t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
      }
      setTasks(filtered);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [activeTab, statusFilter, priorityFilter, isOverdueOnly]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTasks();
  };

  const toggleExpand = (taskId: number) => {
    if (expandedTaskIds.includes(taskId)) {
      setExpandedTaskIds(expandedTaskIds.filter((id) => id !== taskId));
    } else {
      setExpandedTaskIds([...expandedTaskIds, taskId]);
    }
  };

  // Tính số lượng thống kê nhanh
  const overdueCount = tasks.filter((t) => t.isOverdue).length;
  const pendingCount = tasks.filter((t) => t.status === 'Chờ duyệt').length;

  return (
    <div className="min-w-0 space-y-4 md:space-y-6 md:p-6 max-w-7xl mx-auto">
      {/* Top Header & Quick Action */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            Quản lý công việc
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi phân công nhiệm vụ, tiến độ thực hiện và phê duyệt nghiệm thu
          </p>
        </div>

        <div className="flex w-full items-center md:w-auto">
          <button
            onClick={onOpenCreate}
            className="w-full justify-center px-4 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white rounded-xl font-semibold text-sm shadow-md shadow-blue-500/20 transition-all flex items-center space-x-2 cursor-pointer md:w-auto"
          >
            <span>➕</span>
            <span>Giao việc mới</span>
          </button>
        </div>
      </div>

      {/* 4 Tabs Phân Loại */}
      <div className="mobile-scroll flex items-center space-x-1 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'all', label: 'Tất cả công việc' },
          { id: 'assigned_to_me', label: 'Việc tôi làm' },
          { id: 'assigned_by_me', label: 'Việc tôi giao' },
          { id: 'department', label: 'Việc bộ phận' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`shrink-0 px-4 py-3 text-sm font-semibold transition-all border-b-2 whitespace-nowrap cursor-pointer ${
              activeTab === tab.id
                ? 'border-[#0A66C2] text-[#0A66C2]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search form */}
          <form onSubmit={handleSearch} className="flex w-full min-w-0 flex-1 items-center space-x-2 md:max-w-md">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tiêu đề hoặc mã CV-..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-semibold transition-colors"
            >
              Tìm
            </button>
          </form>

          {/* Select filters */}
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {/* Trạng thái */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] sm:w-auto"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="Chưa làm">Chưa làm</option>
              <option value="Đang làm">Đang làm</option>
              <option value="Chờ duyệt">Chờ duyệt</option>
              <option value="Hoàn thành">Hoàn thành</option>
            </select>

            {/* Độ ưu tiên */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0A66C2] sm:w-auto"
            >
              <option value="all">Tất cả ưu tiên</option>
              <option value="low">Thấp</option>
              <option value="normal">Bình thường</option>
              <option value="high">Cao</option>
              <option value="urgent">Khẩn cấp</option>
            </select>

            {/* Checkbox quá hạn */}
            <label className="col-span-2 flex items-center justify-center space-x-1.5 px-3 py-2 bg-red-50/70 border border-red-200 rounded-xl text-xs font-bold text-red-700 cursor-pointer sm:w-auto">
              <input
                type="checkbox"
                checked={isOverdueOnly}
                onChange={(e) => setIsOverdueOnly(e.target.checked)}
                className="rounded accent-red-600"
              />
              <span>Quá hạn ({overdueCount})</span>
            </label>
          </div>
        </div>

        {/* Quick summary line */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 pt-1 border-t border-slate-100">
          <span>Tổng số: <strong className="text-gray-800">{tasks.length}</strong> công việc</span>
          <span>Chờ duyệt: <strong className="text-amber-700">{pendingCount}</strong></span>
          <span>Quá hạn: <strong className="text-red-600">{overdueCount}</strong></span>
        </div>
      </div>

      {/* Task Table List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-3 border-[#0A66C2]/30 border-t-[#0A66C2] rounded-full animate-spin" />
            <span className="text-xs text-gray-500">Đang tải danh sách công việc...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <span className="text-4xl">📋</span>
            <h4 className="text-base font-bold text-gray-800">Không tìm thấy công việc phù hợp</h4>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Không có đầu việc nào thuộc bộ lọc hiện tại. Bạn có thể giao việc mới hoặc đổi tiêu chí tìm kiếm.
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-3 p-3 md:hidden">
            {tasks.map((t) => {
              const hasSub = Boolean(t.subTasks?.length);
              const isExpanded = expandedTaskIds.includes(t.id);
              return (
                <article key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-700">{t.code}</span>
                      {t.recurrenceRule && <span className="text-xs text-blue-600">🔄</span>}
                      {t.isOverdue && <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">Quá hạn</span>}
                    </div>
                    <span className={`rounded-lg px-2 py-1 text-[11px] font-bold ${TASK_STATUS_LABELS[t.status]?.color || 'bg-gray-100'}`}>
                      {t.status}
                    </span>
                  </div>

                  <button type="button" onClick={() => onSelectTask(t)} className="mt-3 block w-full break-words text-left text-sm font-bold leading-snug text-gray-900">
                    {t.title}
                  </button>

                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase text-gray-400">Người thực hiện</span>
                      <span className="block truncate font-semibold text-gray-800">{t.assignee?.name || 'Chưa giao'}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-gray-400">Hạn hoàn thành</span>
                      <span className={`font-semibold ${t.isOverdue ? 'text-red-600' : 'text-gray-700'}`}>
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] font-bold text-gray-600">
                      <span className={`rounded px-2 py-0.5 ${TASK_PRIORITY_LABELS[t.priority]?.color || 'bg-gray-100'}`}>
                        {TASK_PRIORITY_LABELS[t.priority]?.label || t.priority}
                      </span>
                      <span>{t.progressPercent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className={`h-full rounded-full ${t.progressPercent === 100 ? 'bg-emerald-500' : 'bg-[#0A66C2]'}`} style={{ width: `${t.progressPercent}%` }} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    {hasSub ? (
                      <button type="button" onClick={() => toggleExpand(t.id)} className="text-xs font-semibold text-gray-600">
                        {isExpanded ? 'Ẩn việc con ▲' : `${t.subTasks?.length} việc con ▼`}
                      </button>
                    ) : <span />}
                    <button type="button" onClick={() => onSelectTask(t)} className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-[#0A66C2]">
                      Xem chi tiết
                    </button>
                  </div>

                  {hasSub && isExpanded && (
                    <div className="mt-3 space-y-2 border-l-2 border-blue-200 pl-3">
                      {t.subTasks?.map((st) => (
                        <div key={st.id} className="block w-full rounded-xl bg-slate-50 p-3 text-left">
                          <span className="font-mono text-[10px] font-bold text-slate-500">{st.code}</span>
                          <span className="mt-0.5 block break-words text-xs font-semibold text-gray-800">{st.title}</span>
                          <span className="mt-1 flex items-center justify-between text-[10px] text-gray-500">
                            <span>{st.assignee?.name || 'Chưa gán'}</span>
                            <strong className="text-blue-700">{st.progressPercent}%</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <div className="mobile-scroll hidden overflow-x-auto md:block">
            <table className="min-w-[1050px] w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200/70 text-gray-500 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">Mã & Tiêu đề</th>
                  <th className="py-3 px-4">Người thực hiện</th>
                  <th className="py-3 px-4">Hạn hoàn thành</th>
                  <th className="py-3 px-4">Ưu tiên</th>
                  <th className="py-3 px-4 w-40">Tiến độ</th>
                  <th className="py-3 px-4">Trạng thái</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((t) => {
                  const hasSub = t.subTasks && t.subTasks.length > 0;
                  const isExpanded = expandedTaskIds.includes(t.id);

                  return (
                    <React.Fragment key={t.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        {/* Expand toggle */}
                        <td className="py-3.5 px-4 text-center">
                          {hasSub ? (
                            <button
                              onClick={() => toggleExpand(t.id)}
                              className="w-5 h-5 rounded hover:bg-slate-200 text-gray-500 flex items-center justify-center font-bold text-xs"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          ) : (
                            <span className="text-gray-300">•</span>
                          )}
                        </td>

                        {/* Code & Title */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                              {t.code}
                            </span>
                            {t.recurrenceRule && (
                              <span className="text-blue-600 font-bold text-xs" title={`Lặp lại: ${t.recurrenceRule}`}>
                                🔄
                              </span>
                            )}
                            {t.isOverdue && (
                              <span className="bg-red-500 text-white font-bold text-[10px] px-1.5 py-0.5 rounded shadow-sm">
                                Quá hạn
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => onSelectTask(t)}
                            className="text-left font-bold text-gray-900 hover:text-[#0A66C2] transition-colors mt-0.5 block"
                          >
                            {t.title}
                          </button>
                          {t.tags && (
                            <span className="text-[10px] text-gray-400 mt-0.5 block">
                              🏷️ {t.tags}
                            </span>
                          )}
                        </td>

                        {/* Assignee */}
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-gray-800">
                            {t.assignee?.name || <span className="text-gray-400 italic">Chưa giao</span>}
                          </span>
                          <span className="text-[10px] text-gray-400 block">
                            Giao bởi: {t.createdBy?.name || '---'}
                          </span>
                        </td>

                        {/* Due date */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`font-semibold ${
                              t.isOverdue ? 'text-red-600 font-bold' : 'text-gray-700'
                            }`}
                          >
                            {t.dueDate
                              ? new Date(t.dueDate).toLocaleDateString('vi-VN')
                              : '---'}
                          </span>
                        </td>

                        {/* Priority */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              TASK_PRIORITY_LABELS[t.priority]?.color || 'bg-gray-100'
                            }`}
                          >
                            {TASK_PRIORITY_LABELS[t.priority]?.label || t.priority}
                          </span>
                        </td>

                        {/* Progress */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-700">
                              <span>{t.progressPercent}%</span>
                              {hasSub && (
                                <span className="text-[10px] text-gray-400 font-normal">
                                  ({t.subTasks?.length} việc con)
                                </span>
                              )}
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  t.progressPercent === 100
                                    ? 'bg-emerald-500'
                                    : 'bg-[#0A66C2]'
                                }`}
                                style={{ width: `${t.progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-[11px] font-bold ${
                              TASK_STATUS_LABELS[t.status]?.color || 'bg-gray-100'
                            }`}
                          >
                            {t.status}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => onSelectTask(t)}
                            className="px-2.5 py-1.5 bg-blue-50 text-[#0A66C2] hover:bg-blue-100 font-bold rounded-lg text-xs transition-colors"
                          >
                            Xem chi tiết
                          </button>
                        </td>
                      </tr>

                      {/* Render nested subtasks row if expanded */}
                      {hasSub && isExpanded && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="p-4 pl-12">
                            <div className="space-y-2 border-l-2 border-blue-300 pl-4">
                              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Các việc con trực thuộc ({t.subTasks?.length}):
                              </div>
                              {t.subTasks?.map((st) => (
                                <div
                                  key={st.id}
                                  className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-slate-600 text-[10px]">
                                      {st.code}
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                      {st.title}
                                    </span>
                                    {st.isOverdue && (
                                      <span className="bg-red-500 text-white font-bold text-[9px] px-1.5 py-0.2 rounded">
                                        Quá hạn
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-4">
                                    <span className="text-gray-500">
                                      {st.assignee?.name || 'Chưa gán'}
                                    </span>
                                    <span className="font-bold text-blue-700">
                                      {st.progressPercent}%
                                    </span>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        TASK_STATUS_LABELS[st.status]?.color || 'bg-gray-100'
                                      }`}
                                    >
                                      {st.status}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
};
