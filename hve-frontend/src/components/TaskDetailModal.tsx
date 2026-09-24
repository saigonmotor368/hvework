import React, { useState, useEffect } from "react";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskItem,
  type ProjectItem,
} from "../types";
import { MOCK_TASKS } from "../mockData";
import { authenticatedFileUrl, fetchWithSession } from "../api/client";
import { ENABLE_MOCK_DATA } from "../config";
import { BrandLoader } from "./BrandLoader";
import { UserNameButton } from "./UserNameButton";

interface TaskDetailModalProps {
  taskId: number;
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  apiBaseUrl: string;
  users: Array<{ id: number; name: string; email: string }>;
  showToast: (msg: string, type?: "success" | "error") => void;
  onRefreshList: () => void;
  onOpenCreateSubtask: (parent: TaskItem) => void;
  onSelectTask: (taskId: number) => void;
  projects: ProjectItem[];
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  taskId,
  isOpen,
  onClose,
  currentUser,
  apiBaseUrl,
  users,
  showToast,
  onRefreshList,
  onOpenCreateSubtask,
  onSelectTask,
  projects,
}) => {
  const [task, setTask] = useState<TaskItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressNote, setProgressNote] = useState<string>("");
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  // Comment state
  const [commentContent, setCommentContent] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<number[]>([]);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  const fetchTaskDetail = async () => {
    setFetchError(null);
    const token = localStorage.getItem("access_token");

    if (ENABLE_MOCK_DATA && (!token || token === "mock_token_demo")) {
      const mock = MOCK_TASKS.find((t) => t.id === taskId);
      if (mock) {
        setTask(mock);
        setProgress(mock.progressPercent || 0);
      } else {
        setFetchError("Không tìm thấy dữ liệu công việc.");
      }
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetchWithSession(`${apiBaseUrl}/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Không thể tải thông tin công việc");
      }
      const data: TaskItem = await res.json();
      setTask(data);
      setProgress(data.progressPercent || 0);
    } catch (err: any) {
      const mock = MOCK_TASKS.find((t) => t.id === taskId);
      if (mock) {
        setTask(mock);
        setProgress(mock.progressPercent || 0);
      } else {
        setFetchError(err.message || "Lỗi kết nối máy chủ");
        showToast(err.message || "Lỗi tải công việc", "error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && taskId) {
      fetchTaskDetail();
    }
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const handleUpdateProgress = async () => {
    if (!task) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      setIsUpdatingProgress(true);
      const res = await fetchWithSession(
        `${apiBaseUrl}/tasks/${task.id}/progress`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            progressPercent: Number(progress),
            note: progressNote.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Cập nhật tiến độ thất bại");
      }

      showToast("Cập nhật tiến độ thành công!");
      setProgressNote("");
      fetchTaskDetail();
      onRefreshList();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi cập nhật tiến độ", "error");
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  const handleAcceptTask = async () => {
    if (!task) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      setIsAccepting(true);
      const res = await fetchWithSession(
        `${apiBaseUrl}/tasks/${task.id}/accept`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể nhận công việc");
      }
      showToast("Đã nhận việc. Bạn có thể cập nhật tiến độ ngay bây giờ!");
      await fetchTaskDetail();
      onRefreshList();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi nhận công việc", "error");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleAcceptSubTask = async (subTaskId: number) => {
    const token = localStorage.getItem("access_token");
    if (!token) return;
    try {
      setIsAccepting(true);
      const res = await fetchWithSession(
        `${apiBaseUrl}/tasks/${subTaskId}/accept`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tiếp nhận nhiệm vụ");
      }
      showToast("Đã tiếp nhận nhiệm vụ. Bạn có thể cập nhật tiến độ.");
      await fetchTaskDetail();
      onRefreshList();
    } catch (err: any) {
      showToast(err.message || "Không thể tiếp nhận nhiệm vụ", "error");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!task) return;
    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      setIsConfirming(true);
      const res = await fetchWithSession(
        `${apiBaseUrl}/tasks/${task.id}/confirm-completion`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Xác nhận hoàn thành thất bại");
      }

      const resData = await res.json();
      if (resData.nextTask) {
        showToast(
          `Đã hoàn thành! Chu kỳ tiếp theo [${resData.nextTask.code}] đã tự động được khởi tạo.`,
        );
      } else {
        showToast("Đã xác nhận hoàn thành công việc!");
      }

      fetchTaskDetail();
      onRefreshList();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi xác nhận hoàn thành", "error");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim() || !task) return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    try {
      setIsSubmittingComment(true);
      const res = await fetchWithSession(
        `${apiBaseUrl}/tasks/${task.id}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            content: commentContent.trim(),
            mentions:
              selectedMentions.length > 0 ? selectedMentions : undefined,
          }),
        },
      );

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Không thể gửi bình luận");
      }

      setCommentContent("");
      setSelectedMentions([]);
      fetchTaskDetail();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi gửi bình luận", "error");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const isCreator = task?.createdById === currentUser?.id;
  const isCeo = currentUser?.roles?.includes("ceo");
  const canCreateTask =
    currentUser?.roles?.includes("department_head") ||
    currentUser?.roles?.includes("accountant") ||
    currentUser?.roles?.includes("ceo") ||
    currentUser?.roles?.includes("bgd");
  const hasSubTasks = task?.subTasks && task.subTasks.length > 0;
  const canConfirm = task?.status === "Chờ duyệt" && (isCreator || isCeo);
  const isPrimaryAssignee = task?.assigneeId === currentUser?.id;
  const canAccept = isPrimaryAssignee && task?.status === "Chưa làm";
  const canUpdateProgress = isPrimaryAssignee && task?.status !== "Chưa làm";
  const completedSubTasks =
    task?.subTasks?.filter((subTask) => subTask.status === "Hoàn thành")
      .length || 0;
  const userById = new Map(users.map((candidate) => [candidate.id, candidate]));
  const collaboratorUsers = (task?.collaboratorIds || [])
    .map((id) => userById.get(id))
    .filter(Boolean) as Array<{ id: number; name: string; email: string }>;
  const initials = (name?: string | null) =>
    (name || "?")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  const avatar = (
    person?: { id?: number; name?: string; avatarUrl?: string | null } | null,
    title?: string,
  ) => {
    const imageUrl = person?.avatarUrl
      ? authenticatedFileUrl(
          apiBaseUrl,
          person.avatarUrl,
          localStorage.getItem("access_token") || "",
        )
      : null;
    return (
      <span
        title={title || person?.name || "Người dùng"}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-violet-500 text-[10px] font-black text-white shadow-sm"
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={person?.name || "Ảnh đại diện"}
            className="h-full w-full object-cover"
          />
        ) : (
          initials(person?.name)
        )}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-start justify-between gap-3 bg-slate-50/50">
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
            <span className="font-mono text-xs font-bold px-2.5 py-1 bg-slate-200 text-slate-800 rounded-lg">
              {task?.code || "CV-..."}
            </span>
            <h3 className="w-full text-base md:w-auto md:max-w-md md:text-lg font-bold text-gray-900 break-words md:truncate">
              {task?.title || "Chi tiết công việc"}
            </h3>
            {task?.isOverdue && (
              <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-sm animate-pulse">
                Quá hạn
              </span>
            )}
            {task?.project && (
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-[#0A66C2]">
                🏗️ {task.project.code} — {task.project.name}
              </span>
            )}
            {task?.visibility === "company" && (
              <span className="rounded-md bg-cyan-50 px-2 py-0.5 text-[11px] font-bold text-cyan-700 ring-1 ring-cyan-200">
                👁️ Toàn công ty được xem
              </span>
            )}
            {projects
              .filter((project) => task?.linkedProjectIds?.includes(project.id))
              .map((project) => (
                <span
                  key={project.id}
                  className="rounded-md bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
                >
                  ↔ {project.code}
                </span>
              ))}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-gray-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {isLoading ? (
          <BrandLoader compact label="Đang tải dữ liệu công việc..." />
        ) : !task ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold border border-amber-200">
              !
            </div>
            <div>
              <h4 className="font-bold text-gray-800 text-base">
                Không thể tải dữ liệu công việc
              </h4>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                {fetchError ||
                  "Công việc không tồn tại hoặc bạn chưa được phân quyền truy cập."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs font-semibold rounded-xl transition-colors"
            >
              Đóng cửa sổ
            </button>
          </div>
        ) : (
          <div className="mobile-scroll flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {task.parentTask && (
              <button
                type="button"
                onClick={() => onSelectTask(task.parentTask!.id)}
                className="flex max-w-full items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left text-xs font-bold text-[#0A66C2] hover:bg-blue-100"
              >
                <span>←</span>
                <span className="truncate">
                  Quay lại {task.parentTask.code} — {task.parentTask.title}
                </span>
              </button>
            )}
            {canAccept && (
              <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-black text-blue-950">
                    Công việc mới chờ tiếp nhận
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700">
                    Chọn “Tiếp nhận công việc” để xác nhận bắt đầu xử lý. Sau đó
                    bạn có thể cập nhật phần trăm tiến độ và ghi chú thực hiện.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAcceptTask}
                  disabled={isAccepting}
                  className="min-h-11 shrink-0 rounded-xl bg-[#0A66C2] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isAccepting ? "Đang tiếp nhận..." : "✓ Tiếp nhận công việc"}
                </button>
              </div>
            )}

            {/* Thông báo nghiệm thu hoàn thành */}
            {canConfirm && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    Công việc đã hoàn thành 100% và đang Chờ bạn duyệt
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    {task.recurrenceRule
                      ? `Công việc có thiết lập lặp lại [${task.recurrenceRule}]. Khi bạn bấm xác nhận, hệ thống sẽ tự động tạo kỳ tiếp theo.`
                      : "Người thực hiện đã hoàn thành công việc. Vui lòng kiểm tra và xác nhận nghiệm thu."}
                  </p>
                </div>
                <button
                  onClick={handleConfirmCompletion}
                  disabled={isConfirming}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
                >
                  {isConfirming ? "Đang xác nhận..." : "✓ Xác nhận hoàn thành"}
                </button>
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,.65fr)]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      👥 Nhóm thực hiện
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Người phụ trách chính và những người cùng phối hợp.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-[#0A66C2]">
                    {(task.assignee ? 1 : 0) + collaboratorUsers.length} người
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.assignee && (
                    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2">
                      {avatar(task.assignee)}
                      <div className="min-w-0">
                        <UserNameButton
                          user={task.assignee}
                          className="text-xs"
                        />
                        <p className="text-[10px] font-semibold text-blue-600">
                          Phụ trách chính
                        </p>
                      </div>
                    </div>
                  )}
                  {collaboratorUsers.map((person) => (
                    <div
                      key={person.id}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                    >
                      {avatar(person)}
                      <div className="min-w-0">
                        <UserNameButton user={person} className="text-xs" />
                        <p className="text-[10px] text-slate-500">Phối hợp</p>
                      </div>
                    </div>
                  ))}
                  {!task.assignee && collaboratorUsers.length === 0 && (
                    <p className="text-xs italic text-slate-400">
                      Chưa chỉ định người thực hiện.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-cyan-50 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">
                      👁️ Người đã xem
                    </h4>
                    <p className="mt-0.5 text-[11px] text-emerald-700">
                      Cập nhật tự động khi mở chi tiết.
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-emerald-700 shadow-sm">
                    {task.viewers?.length || 0}
                  </span>
                </div>
                <div className="flex flex-wrap -space-x-2">
                  {(task.viewers || []).slice(0, 10).map((viewer) => (
                    <button
                      key={viewer.user.id}
                      type="button"
                      onClick={() =>
                        window.dispatchEvent(
                          new CustomEvent("hve-open-user-profile", {
                            detail: { id: viewer.user.id },
                          }),
                        )
                      }
                      className="rounded-full transition hover:z-10 hover:-translate-y-0.5"
                      title={`${viewer.user.name} · xem gần nhất ${new Date(viewer.lastViewedAt).toLocaleString("vi-VN")}`}
                    >
                      {avatar(viewer.user)}
                    </button>
                  ))}
                  {(task.viewers?.length || 0) > 10 && (
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-emerald-700 text-[10px] font-black text-white">
                      +{(task.viewers?.length || 0) - 10}
                    </span>
                  )}
                </div>
                {task.viewers?.[0] && (
                  <p className="mt-3 truncate text-[11px] text-emerald-800">
                    Gần nhất: <b>{task.viewers[0].user.name}</b> ·{" "}
                    {new Date(task.viewers[0].lastViewedAt).toLocaleString(
                      "vi-VN",
                    )}
                  </p>
                )}
              </section>
            </div>

            {/* Quick Metadata Grid */}
            <div className="grid grid-cols-1 min-[380px]:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs">
              <div>
                <span className="text-gray-400 block font-medium">
                  Người giao việc
                </span>
                <span className="font-bold text-gray-800 mt-0.5 block">
                  <UserNameButton user={task.createdBy} />
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">
                  Người thực hiện
                </span>
                <span className="font-bold text-gray-800 mt-0.5 block">
                  <UserNameButton
                    user={task.assignee}
                    fallback="Chưa phân công"
                  />
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">
                  Hạn hoàn thành
                </span>
                <span
                  className={`font-bold mt-0.5 block ${
                    task.isOverdue ? "text-red-600" : "text-gray-800"
                  }`}
                >
                  {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString("vi-VN")
                    : "Không thời hạn"}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block font-medium">
                  Trạng thái & Ưu tiên
                </span>
                <div className="flex items-center space-x-1.5 mt-0.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      TASK_STATUS_LABELS[task.status]?.color || "bg-gray-100"
                    }`}
                  >
                    {task.status}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      TASK_PRIORITY_LABELS[task.priority]?.color ||
                      "bg-gray-100"
                    }`}
                  >
                    {TASK_PRIORITY_LABELS[task.priority]?.label ||
                      task.priority}
                  </span>
                </div>
              </div>
            </div>

            {/* Mô tả */}
            {task.description && (
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Mô tả công việc
                </h4>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {task.description}
                </div>
              </div>
            )}

            {/* Tiến độ (Progress Bar & Update) */}
            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold text-[#0A66C2] uppercase tracking-wider">
                    Tiến độ công việc
                  </h4>
                  <span className="text-xs text-gray-500">
                    {hasSubTasks
                      ? "Tiến độ được tự động tổng hợp từ các nhiệm vụ thành phần"
                      : canAccept
                        ? "Tiếp nhận công việc trước khi cập nhật tiến độ"
                        : canUpdateProgress
                          ? "Kéo thanh trượt để cập nhật tiến độ thực hiện"
                          : "Chỉ người thực hiện chính được cập nhật tiến độ"}
                  </span>
                </div>
                <span className="text-lg font-bold text-[#0A66C2]">
                  {task.progressPercent}%
                </span>
              </div>

              {/* Progress bar visual */}
              <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#0A66C2] h-full rounded-full transition-all duration-300"
                  style={{ width: `${task.progressPercent}%` }}
                />
              </div>

              {/* Cập nhật tiến độ form (chỉ khi không có subtasks và chưa hoàn thành) */}
              {!hasSubTasks &&
                task.status !== "Hoàn thành" &&
                canUpdateProgress && (
                  <div className="pt-2 border-t border-blue-100/60 space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-4">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={progress}
                        onChange={(e) => setProgress(Number(e.target.value))}
                        className="flex-1 accent-[#0A66C2] cursor-pointer"
                      />
                      <div className="flex space-x-1">
                        {[25, 50, 75, 100].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setProgress(val)}
                            className="px-2 py-0.5 text-xs font-semibold bg-white border border-blue-200 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                          >
                            {val}%
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:space-x-2">
                      <input
                        type="text"
                        value={progressNote}
                        onChange={(e) => setProgressNote(e.target.value)}
                        placeholder="Ghi chú tiến độ (VD: đã xong bản thảo lần 1)..."
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                      />
                      <button
                        onClick={handleUpdateProgress}
                        disabled={isUpdatingProgress}
                        className="px-3.5 py-1.5 bg-[#0A66C2] text-white text-xs font-bold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isUpdatingProgress ? "Lưu..." : "Cập nhật"}
                      </button>
                    </div>
                    {progress === 100 && (
                      <p className="text-[11px] text-amber-700 font-medium">
                        ⚠️ Khi cập nhật 100%, trạng thái việc sẽ chuyển sang
                        "Chờ duyệt" để người giao việc xác nhận.
                      </p>
                    )}
                  </div>
                )}
            </div>

            {/* Danh sách nhiệm vụ */}
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900">
                      ☑️ Danh sách nhiệm vụ
                    </h4>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Phân công nhiệm vụ cho các bộ phận phụ trách và theo dõi
                      tiến độ chung.
                    </p>
                  </div>
                  {/* Chỉ cho phép thêm nhiệm vụ nếu đây là công việc chính */}
                  {canCreateTask &&
                    !task.parentTaskId &&
                    task.status !== "Hoàn thành" &&
                    !task.recurrenceRule && (
                      <button
                        onClick={() => onOpenCreateSubtask(task)}
                        className="text-xs font-bold text-[#0A66C2] hover:underline flex items-center"
                      >
                        + Thêm nhiệm vụ
                      </button>
                    )}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#0A66C2] to-emerald-500 transition-all"
                      style={{
                        width: `${task.subTasks?.length ? (completedSubTasks / task.subTasks.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-black text-slate-700">
                    {completedSubTasks}/{task.subTasks?.length || 0} hoàn thành
                  </span>
                </div>
              </div>

              {task.subTasks && task.subTasks.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {task.subTasks.map((st) => (
                    <div
                      key={st.id}
                      className="group flex flex-col gap-3 p-4 text-xs transition hover:bg-blue-50/40 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 text-xs font-black ${
                            st.status === "Hoàn thành"
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-slate-400">
                              {st.code}
                            </span>
                            <span
                              className={`font-semibold text-gray-900 ${st.status === "Hoàn thành" ? "line-through opacity-60" : ""}`}
                            >
                              {st.title}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                            <span>{st.progressPercent}% tiến độ</span>
                            {st.dueDate && (
                              <span>
                                · Hạn{" "}
                                {new Date(st.dueDate).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                        {st.isOverdue && (
                          <span className="bg-red-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded">
                            Quá hạn
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <div className="flex items-center -space-x-2">
                          {st.assignee ? (
                            avatar(st.assignee)
                          ) : (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-bold text-slate-500">
                              ?
                            </span>
                          )}
                          {(st.collaboratorIds?.length || 0) > 0 && (
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-violet-600 text-[10px] font-black text-white">
                              +{st.collaboratorIds!.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              TASK_STATUS_LABELS[st.status]?.color ||
                              "bg-gray-100"
                            }`}
                          >
                            {st.status}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectTask(st.id)}
                          className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-[#0A66C2] hover:bg-blue-50"
                        >
                          Mở chi tiết
                        </button>
                        {st.assigneeId === currentUser?.id &&
                          st.status === "Chưa làm" && (
                            <button
                              type="button"
                              onClick={() => void handleAcceptSubTask(st.id)}
                              disabled={isAccepting}
                              className="rounded-lg bg-[#0A66C2] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isAccepting ? "Đang tiếp nhận…" : "✓ Tiếp nhận"}
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-5 text-center text-xs italic text-gray-400">
                  Chưa có nhiệm vụ thành phần.{" "}
                  {!task.parentTaskId &&
                    !task.recurrenceRule &&
                    "Bạn có thể phân chia công việc thành các nhiệm vụ để thuận tiện theo dõi."}
                </p>
              )}
            </div>

            {/* File đính kèm */}
            {task.attachments && task.attachments.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h4 className="mb-3 text-sm font-black text-slate-900">
                  📎 Tệp đính kèm ({task.attachments.length})
                </h4>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {task.attachments.map((file) => (
                    <a
                      key={file.id}
                      href={authenticatedFileUrl(
                        apiBaseUrl,
                        file.fileUrl,
                        localStorage.getItem("access_token") || "",
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-sm">
                        {file.mimeType.includes("pdf")
                          ? "📕"
                          : file.mimeType.includes("image")
                            ? "🖼️"
                            : "📄"}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{file.fileName}</span>
                        <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                          {file.size >= 1024 * 1024
                            ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                            : `${Math.max(1, Math.round(file.size / 1024))} KB`}
                        </span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Trao đổi / Bình luận & Nhắc tên */}
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Trao đổi & Cập nhật tiến độ ({task.comments?.length || 0})
              </h4>

              {/* Comment list */}
              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">
                          <UserNameButton user={c.user} fallback="Người dùng" />
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(c.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-gray-400 italic">
                    Chưa có bình luận nào.
                  </p>
                )}
              </div>

              {/* Add comment form */}
              <form onSubmit={handleSendComment} className="space-y-2 pt-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    placeholder="Viết bình luận, phản hồi hoặc cập nhật tình hình..."
                    className="flex-1 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingComment || !commentContent.trim()}
                    className="px-4 py-2 bg-[#0A66C2] text-white text-xs font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    Gửi
                  </button>
                </div>

                {/* Mention picker */}
                <div className="flex items-center space-x-2 text-[11px] text-gray-500">
                  <span>Nhắc tên (@):</span>
                  <div className="flex flex-wrap gap-1">
                    {users.slice(0, 6).map((u) => {
                      const isMentioned = selectedMentions.includes(u.id);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isMentioned) {
                              setSelectedMentions(
                                selectedMentions.filter((id) => id !== u.id),
                              );
                            } else {
                              setSelectedMentions([...selectedMentions, u.id]);
                            }
                          }}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                            isMentioned
                              ? "bg-blue-100 text-blue-800 font-bold"
                              : "bg-slate-100 text-gray-600 hover:bg-slate-200"
                          }`}
                        >
                          @{u.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
