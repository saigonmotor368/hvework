import React, { useEffect, useState } from "react";
import { fetchWithSession } from "../api/client";
import { TASK_PRIORITY_LABELS, type TaskItem } from "../types";

type Person = { id: number; name: string; email: string };

async function callTaskApi(
  apiBaseUrl: string,
  path: string,
  method: "POST" | "PUT",
  body: Record<string, unknown>,
) {
  const res = await fetchWithSession(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("access_token") || ""}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (Array.isArray(data.message) ? data.message.join("; ") : data.message) ||
        "Không thực hiện được. Vui lòng thử lại.",
    );
  }
  return data;
}

function Shell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-black text-slate-900">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="h-8 w-8 shrink-0 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:border-[#0A66C2] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/30";
const labelClass = "mb-1 block text-xs font-bold text-slate-600";

interface CommonProps {
  apiBaseUrl: string;
  task: TaskItem;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Tạm ngừng / hủy / tiếp tục / khôi phục — cùng một khung nhập lý do. */
export const TaskReasonDialog: React.FC<
  CommonProps & { action: "pause" | "cancel" | "resume" }
> = ({ apiBaseUrl, task, action, onClose, onDone }) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const wasCancelled = task.status === "Đã hủy";
  const config = {
    pause: {
      title: "⏸️ Tạm ngừng công việc",
      subtitle:
        "Giữ nguyên tiến độ, ngừng nhắc hạn và không tính vào tải công việc. Các nhiệm vụ con chưa xong cũng được tạm ngừng. Có thể tiếp tục bất cứ lúc nào.",
      required: true,
      button: "Tạm ngừng",
      tone: "bg-amber-600 hover:bg-amber-700",
      done: "Đã tạm ngừng công việc.",
      placeholder: "VD: Chờ khách hàng bàn giao mặt bằng",
    },
    cancel: {
      title: "🚫 Hủy công việc",
      subtitle:
        "Công việc và các nhiệm vụ con chưa xong sẽ bị đóng, không sinh kỳ lặp mới và không tính vào tỷ lệ hoàn thành. Vẫn có thể khôi phục sau.",
      required: true,
      button: "Hủy công việc",
      tone: "bg-rose-600 hover:bg-rose-700",
      done: "Đã hủy công việc.",
      placeholder: "VD: Khách hàng đổi kế hoạch, không còn nhu cầu",
    },
    resume: {
      title: wasCancelled ? "♻️ Khôi phục công việc" : "▶️ Tiếp tục công việc",
      subtitle: wasCancelled
        ? "Công việc quay về đúng trạng thái trước khi hủy."
        : "Công việc quay về đúng trạng thái trước khi tạm ngừng; nhắc hạn hoạt động lại. Nếu hạn đã trôi qua, hãy Gia hạn sau khi tiếp tục.",
      required: false,
      button: wasCancelled ? "Khôi phục" : "Tiếp tục",
      tone: "bg-emerald-600 hover:bg-emerald-700",
      done: wasCancelled ? "Đã khôi phục công việc." : "Đã tiếp tục công việc.",
      placeholder: "Ghi chú (không bắt buộc)",
    },
  }[action];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (config.required && reason.trim().length < 5) {
      setError("Vui lòng nhập lý do (tối thiểu 5 ký tự).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await callTaskApi(apiBaseUrl, `/tasks/${task.id}/${action}`, "POST", {
        reason: reason.trim() || undefined,
      });
      onDone(config.done);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thực hiện được");
      setBusy(false);
    }
  };

  return (
    <Shell title={config.title} subtitle={config.subtitle} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          {task.code} — {task.title}
        </p>
        <div>
          <label htmlFor="task-reason" className={labelClass}>
            Lý do {config.required && <span className="text-rose-600">*</span>}
          </label>
          <textarea
            id="task-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder={config.placeholder}
            className={inputClass}
            autoFocus
          />
        </div>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Quay lại
          </button>
          <button
            type="submit"
            disabled={busy}
            className={`rounded-xl px-4 py-2 text-xs font-black text-white disabled:opacity-50 ${config.tone}`}
          >
            {busy ? "Đang xử lý…" : config.button}
          </button>
        </div>
      </form>
    </Shell>
  );
};

const toDateInput = (value?: string | null) =>
  value ? new Date(value).toISOString().slice(0, 10) : "";

/** Gia hạn: hạn mới phải sau hạn hiện tại và có lý do. */
export const TaskExtendDialog: React.FC<CommonProps> = ({
  apiBaseUrl,
  task,
  onClose,
  onDone,
}) => {
  const currentDue = toDateInput(task.dueDate);
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const minDate = currentDue
    ? new Date(new Date(currentDue).getTime() + 86_400_000)
        .toISOString()
        .slice(0, 10)
    : today;

  const quickDays = (days: number) => {
    const base = new Date(currentDue && currentDue > today ? currentDue : today);
    base.setDate(base.getDate() + days);
    setDueDate(base.toISOString().slice(0, 10));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dueDate) return setError("Vui lòng chọn hạn hoàn thành mới.");
    if (reason.trim().length < 5)
      return setError("Vui lòng nhập lý do gia hạn (tối thiểu 5 ký tự).");
    setBusy(true);
    setError("");
    try {
      await callTaskApi(apiBaseUrl, `/tasks/${task.id}/extend`, "POST", {
        dueDate,
        reason: reason.trim(),
      });
      onDone("Đã gia hạn công việc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gia hạn được");
      setBusy(false);
    }
  };

  return (
    <Shell
      title="🗓️ Gia hạn công việc"
      subtitle="Hạn mới phải sau hạn hiện tại. Lý do được ghi vào phần trao đổi và gửi thông báo cho nhóm thực hiện."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          {task.code} — {task.title}
          <span className="ml-2 font-normal text-slate-500">
            Hạn hiện tại:{" "}
            {task.dueDate
              ? new Date(task.dueDate).toLocaleDateString("vi-VN")
              : "chưa đặt"}
          </span>
        </p>
        <div>
          <label htmlFor="task-new-due" className={labelClass}>
            Hạn hoàn thành mới <span className="text-rose-600">*</span>
          </label>
          <input
            id="task-new-due"
            type="date"
            value={dueDate}
            min={minDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={inputClass}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              { label: "+3 ngày", days: 3 },
              { label: "+1 tuần", days: 7 },
              { label: "+2 tuần", days: 14 },
              { label: "+1 tháng", days: 30 },
            ].map((item) => (
              <button
                key={item.days}
                type="button"
                onClick={() => quickDays(item.days)}
                className="rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-bold text-[#0A66C2] hover:bg-blue-50"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="task-extend-reason" className={labelClass}>
            Lý do gia hạn <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="task-extend-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="VD: Khách hàng dời lịch khảo sát"
            className={inputClass}
          />
        </div>
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Quay lại
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#0A66C2] px-4 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Gia hạn"}
          </button>
        </div>
      </form>
    </Shell>
  );
};

/** Sửa thông tin công việc; chỉ gửi những trường thực sự thay đổi. */
export const TaskEditDialog: React.FC<CommonProps & { users: Person[] }> = ({
  apiBaseUrl,
  task,
  users,
  onClose,
  onDone,
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<string>(task.priority);
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [tags, setTags] = useState(task.tags || "");
  const [assigneeId, setAssigneeId] = useState<number | "">(task.assigneeId ?? "");
  const [collaborators, setCollaborators] = useState<number[]>(
    task.collaboratorIds || [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isSubtask = !!task.parentTaskId;

  const toggleCollaborator = (id: number) =>
    setCollaborators((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return setError("Tiêu đề công việc không được để trống.");

    const payload: Record<string, unknown> = {};
    if (title.trim() !== task.title) payload.title = title.trim();
    if (description !== (task.description || "")) payload.description = description;
    if (priority !== task.priority) payload.priority = priority;
    if (startDate && startDate !== toDateInput(task.startDate)) payload.startDate = startDate;
    if (tags !== (task.tags || "")) payload.tags = tags;
    if (assigneeId !== "" && assigneeId !== (task.assigneeId ?? "")) {
      payload.assigneeId = Number(assigneeId);
    }
    const before = [...(task.collaboratorIds || [])].sort().join(",");
    if ([...collaborators].sort().join(",") !== before) {
      payload.collaboratorIds = collaborators;
    }
    if (Object.keys(payload).length === 0) {
      return setError("Chưa có thay đổi nào để lưu.");
    }

    setBusy(true);
    setError("");
    try {
      await callTaskApi(apiBaseUrl, `/tasks/${task.id}`, "PUT", payload);
      onDone("Đã cập nhật công việc.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
      setBusy(false);
    }
  };

  return (
    <Shell
      title="✏️ Sửa công việc"
      subtitle="Muốn đổi hạn hoàn thành, dùng nút Gia hạn để lưu lý do và thông báo cho nhóm thực hiện."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="edit-task-title" className={labelClass}>
            Tiêu đề <span className="text-rose-600">*</span>
          </label>
          <input
            id="edit-task-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClass}
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="edit-task-desc" className={labelClass}>
            Mô tả
          </label>
          <textarea
            id="edit-task-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-task-priority" className={labelClass}>
              Mức ưu tiên
            </label>
            <select
              id="edit-task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className={inputClass}
            >
              {Object.entries(TASK_PRIORITY_LABELS).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-task-start" className={labelClass}>
              Ngày bắt đầu
            </label>
            <input
              id="edit-task-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div>
          <label htmlFor="edit-task-tags" className={labelClass}>
            Nhãn phân loại
          </label>
          <input
            id="edit-task-tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="VD: nhân sự, hợp đồng"
            className={inputClass}
          />
        </div>
        {users.length > 0 && (
          <>
            <div>
              <label htmlFor="edit-task-assignee" className={labelClass}>
                Người thực hiện chính
              </label>
              <select
                id="edit-task-assignee"
                value={assigneeId}
                onChange={(event) =>
                  setAssigneeId(event.target.value ? Number(event.target.value) : "")
                }
                className={inputClass}
              >
                <option value="">— Giữ nguyên / chưa phân công —</option>
                {users.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </div>
            {!isSubtask && (
              <fieldset>
                <legend className={labelClass}>Người phối hợp</legend>
                <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {users
                    .filter((person) => person.id !== Number(assigneeId))
                    .map((person) => {
                      const on = collaborators.includes(person.id);
                      return (
                        <button
                          key={person.id}
                          type="button"
                          onClick={() => toggleCollaborator(person.id)}
                          aria-pressed={on}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                            on
                              ? "bg-[#0A66C2] text-white"
                              : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {person.name}
                        </button>
                      );
                    })}
                </div>
              </fieldset>
            )}
          </>
        )}
        {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            Quay lại
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-[#0A66C2] px-4 py-2 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </Shell>
  );
};
