import React, { useEffect, useMemo, useState } from "react";
import {
  TASK_PRIORITY_LABELS,
  type ProjectItem,
  type TaskItem,
  type WorkloadSummaryItem,
} from "../types";
import { fetchWithSession, uploadAttachment } from "../api/client";
import { MultiFilePicker } from "./MultiFilePicker";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  apiBaseUrl: string;
  users: Array<{
    id: number;
    name: string;
    email: string;
    ledProjects?: Array<{ id: number }>;
    projectMemberships?: Array<{
      position?: string | null;
      project: { id: number };
    }>;
  }>;
  parentTask?: TaskItem | null;
  showToast: (msg: string, type?: "success" | "error") => void;
  projects: ProjectItem[];
  primaryProjects: ProjectItem[];
  currentUser: any;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  apiBaseUrl,
  users,
  parentTask,
  showToast,
  projects,
  primaryProjects,
  currentUser,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<
    "low" | "normal" | "high" | "urgent"
  >("normal");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [collaboratorIds, setCollaboratorIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");
  const [recurrenceRule, setRecurrenceRule] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projectId, setProjectId] = useState<string>(
    parentTask?.projectId ? String(parentTask.projectId) : "",
  );
  const [linkedProjectIds, setLinkedProjectIds] = useState<number[]>(
    parentTask?.linkedProjectIds || [],
  );
  const [workload, setWorkload] = useState<WorkloadSummaryItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    fetchWithSession(`${apiBaseUrl}/tasks/workload?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        if (response.ok) setWorkload(await response.json());
      })
      .catch(() => undefined);
  }, [apiBaseUrl, isOpen, projectId]);

  const workloadByUser = useMemo(
    () => new Map(workload.map((item) => [item.userId, item])),
    [workload],
  );
  const projectPositionByUser = useMemo(() => {
    const selectedProjectId = Number(projectId);
    if (!selectedProjectId) return new Map<number, string>();
    return new Map(
      users.map((candidate) => {
        if (
          candidate.ledProjects?.some(
            (project) => project.id === selectedProjectId,
          )
        ) {
          return [candidate.id, "Trưởng dự án"];
        }
        const position = candidate.projectMemberships?.find(
          (membership) => membership.project.id === selectedProjectId,
        )?.position;
        return [candidate.id, position || ""];
      }),
    );
  }, [projectId, users]);
  const isBoard = currentUser?.roles?.includes("bgd");

  if (!isOpen) return null;

  const handleToggleCollaborator = (userId: number) => {
    if (collaboratorIds.includes(userId)) {
      setCollaboratorIds(collaboratorIds.filter((id) => id !== userId));
    } else {
      setCollaboratorIds([...collaboratorIds, userId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      showToast("Vui lòng nhập tiêu đề công việc", "error");
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      showToast("Phiên đăng nhập đã hết hạn", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      let attachmentIds: number[] = [];

      // 1. Tải file đính kèm nếu có
      for (const file of selectedFiles) {
        const attachmentId = await uploadAttachment(apiBaseUrl, token, file);
        attachmentIds.push(attachmentId);
      }

      // 2. Tạo công việc
      const payload: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId ? parseInt(assigneeId, 10) : undefined,
        collaboratorIds:
          collaboratorIds.length > 0 ? collaboratorIds : undefined,
        tags: tags.trim() || undefined,
        attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
        projectId: projectId ? Number(projectId) : undefined,
        linkedProjectIds:
          linkedProjectIds.length > 0 ? linkedProjectIds : undefined,
      };

      if (parentTask) {
        payload.parentTaskId = parentTask.id;
      } else if (recurrenceRule) {
        payload.recurrenceRule = recurrenceRule;
      }

      const res = await fetchWithSession(`${apiBaseUrl}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Không thể tạo công việc");
      }

      showToast(
        parentTask ? "Thêm việc con thành công!" : "Tạo công việc thành công!",
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi tạo công việc", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 break-words">
              {parentTask
                ? `Thêm việc con cho [${parentTask.code}]`
                : "Giao việc mới"}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {parentTask
                ? `Việc cha: ${parentTask.title}`
                : "Khởi tạo công việc và phân công nhiệm vụ cho nhân sự"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          className="mobile-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tiêu đề công việc <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Soát xét hợp đồng thuê văn phòng Q3/2026"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                Dự án chính
              </label>
              <select
                value={projectId}
                disabled={!!parentTask}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-[#0A66C2] disabled:opacity-70"
              >
                <option value="">Không thuộc dự án</option>
                {primaryProjects
                  .filter((project) => project.isActive)
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} — {project.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                Dự án phối hợp
              </label>
              <select
                multiple
                value={linkedProjectIds.map(String)}
                disabled={!!parentTask}
                onChange={(e) =>
                  setLinkedProjectIds(
                    Array.from(e.target.selectedOptions).map((option) =>
                      Number(option.value),
                    ),
                  )
                }
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm focus:ring-2 focus:ring-[#0A66C2] disabled:opacity-70"
              >
                {projects
                  .filter(
                    (project) =>
                      project.isActive && String(project.id) !== projectId,
                  )
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.code} — {project.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Mô tả chi tiết & Yêu cầu kết quả
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú các yêu cầu, mốc bàn giao cụ thể..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Người thực hiện chính
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
              >
                <option value="">-- Chưa chỉ định --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}{" "}
                    {projectPositionByUser.get(u.id)
                      ? `— ${projectPositionByUser.get(u.id)} `
                      : ""}
                    {workloadByUser.has(u.id)
                      ? `${workloadByUser.get(u.id)?.level === "qua_tai" ? "🔴" : workloadByUser.get(u.id)?.level === "vua" ? "🟡" : "🟢"} ${workloadByUser.get(u.id)?.activeCount} việc`
                      : ""}
                  </option>
                ))}
              </select>
              {isBoard && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-violet-700">
                  Chọn người thực hiện: chỉ người được giao, người phối hợp và
                  anh/chị xem được. Để trống: toàn hệ thống HVE xem được công
                  việc này.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Mức độ ưu tiên
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all font-medium"
              >
                {Object.entries(TASK_PRIORITY_LABELS).map(([key, item]) => (
                  <option key={key} value={key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Ngày bắt đầu
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Hạn hoàn thành
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Người phối hợp */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Người phối hợp ({collaboratorIds.length} đã chọn)
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {users.map((u) => {
                const isSelected = collaboratorIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleToggleCollaborator(u.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-[#0A66C2] text-white shadow-sm"
                        : "bg-white text-gray-700 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {u.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Thẻ phân loại
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="VD: Tài chính, Báo cáo, Giao ban"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
              />
            </div>

            {/* Chỉ hiển thị lặp lại nếu là việc độc lập (không có việc cha) */}
            {!parentTask && (
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Chu kỳ lặp lại
                </label>
                <select
                  value={recurrenceRule}
                  onChange={(e) => setRecurrenceRule(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white transition-all"
                >
                  <option value="">Không lặp lại</option>
                  <option value="daily">Hàng ngày</option>
                  <option value="weekly">Hàng tuần</option>
                  <option value="monthly">Hàng tháng</option>
                </select>
              </div>
            )}
          </div>

          {/* Tệp đính kèm */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Tệp đính kèm (nếu có)
            </label>
            <MultiFilePicker
              files={selectedFiles}
              disabled={isSubmitting}
              onChange={setSelectedFiles}
              onError={(message) => showToast(message, "error")}
            />
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-100 sm:flex sm:items-center sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 hover:bg-slate-100 transition-colors sm:w-auto"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full justify-center px-5 py-2 rounded-xl text-sm font-semibold bg-[#0A66C2] text-white hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50 transition-all flex items-center sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin mr-2" />
                  Đang lưu...
                </>
              ) : parentTask ? (
                "Thêm việc con"
              ) : (
                "Giao việc"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
