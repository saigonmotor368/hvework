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
        throw new Error(data.message || "Không thể nhận việc con");
      }
      showToast("Đã nhận việc con. Bạn có thể bắt đầu cập nhật tiến độ!");
      await fetchTaskDetail();
      onRefreshList();
    } catch (err: any) {
      showToast(err.message || "Lỗi khi nhận việc con", "error");
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
    currentUser?.roles?.includes("ceo") ||
    currentUser?.roles?.includes("bgd");
  const hasSubTasks = task?.subTasks && task.subTasks.length > 0;
  const canConfirm = task?.status === "Chờ duyệt" && (isCreator || isCeo);
  const isPrimaryAssignee = task?.assigneeId === currentUser?.id;
  const canAccept = isPrimaryAssignee && task?.status === "Chưa làm";
  const canUpdateProgress = isPrimaryAssignee && task?.status !== "Chưa làm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
            {canAccept && (
              <div className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-cyan-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-black text-blue-950">
                    Công việc mới đang chờ bạn nhận
                  </h4>
                  <p className="mt-1 text-xs leading-relaxed text-blue-700">
                    Bấm “Nhận việc” để xác nhận bắt đầu xử lý. Sau đó bạn có thể
                    cập nhật phần trăm tiến độ và ghi chú thực hiện.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAcceptTask}
                  disabled={isAccepting}
                  className="min-h-11 shrink-0 rounded-xl bg-[#0A66C2] px-5 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isAccepting ? "Đang nhận việc..." : "✓ Nhận việc"}
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
                      ? "Tiến độ được tự động tính trung bình cộng từ các việc con"
                      : canAccept
                        ? "Nhận việc trước khi cập nhật tiến độ thực hiện"
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

            {/* Danh sách Việc con (Subtasks) */}
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Việc con trực thuộc ({task.subTasks?.length || 0})
                </h4>
                {/* Chỉ cho phép thêm việc con nếu task này chưa phải là việc con */}
                {canCreateTask &&
                  !task.parentTaskId &&
                  task.status !== "Hoàn thành" &&
                  !task.recurrenceRule && (
                    <button
                      onClick={() => onOpenCreateSubtask(task)}
                      className="text-xs font-bold text-[#0A66C2] hover:underline flex items-center"
                    >
                      + Thêm việc con
                    </button>
                  )}
              </div>

              {task.subTasks && task.subTasks.length > 0 ? (
                <div className="space-y-2">
                  {task.subTasks.map((st) => (
                    <div
                      key={st.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                        <span className="font-mono font-bold text-slate-700">
                          {st.code}
                        </span>
                        <span className="font-semibold text-gray-900">
                          {st.title}
                        </span>
                        {st.isOverdue && (
                          <span className="bg-red-500 text-white font-bold text-[10px] px-1.5 py-0.2 rounded">
                            Quá hạn
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                        <span className="text-gray-500">
                          <UserNameButton
                            user={st.assignee}
                            fallback="Chưa gán"
                          />
                        </span>
                        <div className="flex items-center space-x-1">
                          <span className="font-bold text-blue-700">
                            {st.progressPercent}%
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              TASK_STATUS_LABELS[st.status]?.color ||
                              "bg-gray-100"
                            }`}
                          >
                            {st.status}
                          </span>
                        </div>
                        {st.assigneeId === currentUser?.id &&
                          st.status === "Chưa làm" && (
                            <button
                              type="button"
                              onClick={() => void handleAcceptSubTask(st.id)}
                              disabled={isAccepting}
                              className="rounded-lg bg-[#0A66C2] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                            >
                              {isAccepting ? "Đang nhận…" : "✓ Nhận việc"}
                            </button>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">
                  Chưa có việc con nào.{" "}
                  {!task.parentTaskId &&
                    !task.recurrenceRule &&
                    "Bạn có thể chia nhỏ đầu việc để theo dõi."}
                </p>
              )}
            </div>

            {/* File đính kèm */}
            {task.attachments && task.attachments.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Tệp đính kèm ({task.attachments.length})
                </h4>
                <div className="flex flex-wrap gap-2">
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
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-blue-700 hover:bg-blue-50 flex items-center space-x-2 transition-colors"
                    >
                      <span>📎</span>
                      <span className="max-w-[min(200px,55vw)] truncate">
                        {file.fileName}
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
