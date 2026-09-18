import { useEffect, useMemo, useState } from "react";
import { fetchWithSession } from "../api/client";
import { ENABLE_MOCK_DATA } from "../config";
import type { AnnouncementItem, ProjectItem } from "../types";

interface Props {
  apiBaseUrl: string;
  projects: ProjectItem[];
  showToast: (message: string, type?: "success" | "error") => void;
}

interface FormState {
  title: string;
  summary: string;
  content: string;
  type: "news" | "meeting" | "guide";
  priority: "normal" | "important" | "urgent";
  projectId: string;
  isPinned: boolean;
  meetingStartAt: string;
  meetingEndAt: string;
  location: string;
  meetingUrl: string;
  publishedAt: string;
  expiresAt: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  summary: "",
  content: "",
  type: "news",
  priority: "normal",
  projectId: "",
  isPinned: false,
  meetingStartAt: "",
  meetingEndAt: "",
  location: "",
  meetingUrl: "",
  publishedAt: "",
  expiresAt: "",
};

const GUIDE_TEMPLATE: Pick<
  FormState,
  "title" | "summary" | "content" | "type" | "priority" | "isPinned"
> = {
  title: "Hướng dẫn bắt đầu sử dụng HVE Work",
  summary:
    "Các bước cài đặt, đăng nhập, xác thực và sử dụng những chức năng chính của HVE Work.",
  type: "guide",
  priority: "important",
  isPinned: true,
  content: `1. CÀI ĐẶT HVE WORK

• Trên iPhone/iPad: mở HVE Work bằng Safari, chọn Chia sẻ, sau đó chọn “Thêm vào Màn hình chính”.
• Trên Android: mở HVE Work bằng Chrome, chọn menu ⋮, sau đó chọn “Cài đặt ứng dụng”.
• Trên máy tính: có thể sử dụng trực tiếp tại work.huyvoeducation.vn.

2. ĐĂNG NHẬP LẦN ĐẦU

• Nhập đúng email công việc và mật khẩu khởi tạo do IT cung cấp.
• Mở email xác thực được gửi đến hộp thư của bạn.
• Nhập mã xác thực gồm 6 chữ số trên màn hình HVE Work.
• Đổi mật khẩu khởi tạo sang mật khẩu riêng, không chia sẻ mật khẩu hoặc mã xác thực cho người khác.

3. BẬT THÔNG BÁO

• Chọn “Cho phép thông báo” khi HVE Work hỏi quyền.
• Với iPhone/iPad, cần cài HVE Work ra Màn hình chính trước khi bật thông báo.
• Không tắt quyền thông báo nếu bạn cần nhận việc mới và hồ sơ cần xử lý kịp thời.

4. SỬ DỤNG DASHBOARD

• Dashboard chỉ hiển thị dữ liệu thuộc phạm vi vai trò và dự án của bạn.
• Nhấn vào từng thẻ thống kê để mở danh sách hồ sơ hoặc công việc tương ứng.
• Kiểm tra mục “Cần hành động ngay” mỗi ngày.

5. HỒ SƠ VÀ PHÊ DUYỆT

• Chọn “Tạo hồ sơ mới”, điền đầy đủ thông tin và đính kèm tệp nếu cần.
• Kiểm tra nội dung trước khi gửi duyệt.
• Theo dõi trạng thái: Nháp, Chờ duyệt, Trả lại, Từ chối hoặc Đã duyệt.

6. QUẢN LÝ CÔNG VIỆC

• Công việc được giao sẽ xuất hiện trong mục “Quản lý công việc” và chuông thông báo.
• Cập nhật tiến độ và trạng thái thường xuyên.
• Khi hoàn tất, gửi kết quả để người giao việc kiểm tra.

7. HỖ TRỢ

Nếu không đăng nhập được, không nhận mã xác thực hoặc thấy sai dữ liệu, hãy chụp màn hình lỗi và liên hệ Quản trị IT. Không gửi mật khẩu hoặc mã OTP qua tin nhắn.`,
};

function toInputDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toApiDate(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function statusLabel(item: AnnouncementItem) {
  if (item.status === "archived") return "Đã lưu trữ";
  if (
    item.status === "published" &&
    item.expiresAt &&
    new Date(item.expiresAt).getTime() <= Date.now()
  )
    return "Đã hết hạn";
  if (
    item.status === "published" &&
    item.publishedAt &&
    new Date(item.publishedAt).getTime() > Date.now()
  )
    return "Đã lên lịch";
  if (item.status === "published") return "Đang hiển thị";
  return "Bản nháp";
}

export function AdminAnnouncementsView({
  apiBaseUrl,
  projects,
  showToast,
}: Props) {
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.isActive),
    [projects],
  );
  const token =
    localStorage.getItem("access_token") ||
    (ENABLE_MOCK_DATA ? "mock-access-token" : null);

  const loadItems = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/admin/announcements?status=${encodeURIComponent(statusFilter)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) throw new Error("Không thể tải danh sách thông báo");
      setItems(await response.json());
    } catch (error: any) {
      showToast(error.message || "Không thể tải danh sách thông báo", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadItems();
  }, [apiBaseUrl, statusFilter]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const editItem = (item: AnnouncementItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title,
      summary: item.summary || "",
      content: item.content || "",
      type: item.type,
      priority: item.priority,
      projectId: item.projectId ? String(item.projectId) : "",
      isPinned: item.isPinned,
      meetingStartAt: toInputDate(item.meetingStartAt),
      meetingEndAt: toInputDate(item.meetingEndAt),
      location: item.location || "",
      meetingUrl: item.meetingUrl || "",
      publishedAt: toInputDate(item.publishedAt),
      expiresAt: toInputDate(item.expiresAt),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const payload = (status: "draft" | "published") => ({
    title: form.title.trim(),
    summary: form.summary.trim() || null,
    content: form.content.trim(),
    type: form.type,
    priority: form.priority,
    status,
    isPinned: form.isPinned,
    projectId: form.projectId ? Number(form.projectId) : null,
    meetingStartAt: toApiDate(form.meetingStartAt),
    meetingEndAt: toApiDate(form.meetingEndAt),
    location: form.location.trim() || null,
    meetingUrl: form.meetingUrl.trim() || null,
    publishedAt: toApiDate(form.publishedAt),
    expiresAt: toApiDate(form.expiresAt),
  });

  const save = async (status: "draft" | "published") => {
    if (!form.title.trim() || !form.content.trim()) {
      showToast("Vui lòng nhập tiêu đề và nội dung thông báo", "error");
      return;
    }
    if (form.type === "meeting" && !form.meetingStartAt) {
      showToast("Thông báo lịch họp phải có thời gian bắt đầu", "error");
      return;
    }
    if (!token) return;
    setIsSaving(true);
    try {
      const response = await fetchWithSession(
        editingId
          ? `${apiBaseUrl}/admin/announcements/${editingId}`
          : `${apiBaseUrl}/admin/announcements`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload(status)),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = Array.isArray(body.message)
          ? body.message[0]
          : body.message;
        throw new Error(message || "Không thể lưu thông báo");
      }
      showToast(
        status === "published" ? "Đã đăng thông báo" : "Đã lưu bản nháp",
      );
      resetForm();
      await loadItems();
    } catch (error: any) {
      showToast(error.message || "Không thể lưu thông báo", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const archive = async (id: number) => {
    if (!token) return;
    try {
      const response = await fetchWithSession(
        `${apiBaseUrl}/admin/announcements/${id}/archive`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!response.ok) throw new Error("Không thể lưu trữ thông báo");
      showToast("Đã lưu trữ thông báo");
      await loadItems();
    } catch (error: any) {
      showToast(error.message || "Không thể lưu trữ thông báo", "error");
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {editingId ? "Chỉnh sửa thông báo" : "Tạo thông báo mới"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Không chọn dự án để đăng cho toàn hệ thống HVE.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setForm((current) => ({ ...current, ...GUIDE_TEMPLATE }))
            }
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            Dùng bài hướng dẫn mẫu
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Tiêu đề *
            </span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
              maxLength={200}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="Nhập tiêu đề thông báo"
            />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Mô tả ngắn
            </span>
            <input
              value={form.summary}
              onChange={(event) =>
                setForm({ ...form, summary: event.target.value })
              }
              maxLength={500}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:border-blue-500"
              placeholder="Nội dung tóm tắt hiển thị trên dashboard"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Loại thông báo
            </span>
            <select
              value={form.type}
              onChange={(event) =>
                setForm({
                  ...form,
                  type: event.target.value as FormState["type"],
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
            >
              <option value="news">Tin tức</option>
              <option value="meeting">Lịch họp</option>
              <option value="guide">Hướng dẫn sử dụng</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Mức độ
            </span>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm({
                  ...form,
                  priority: event.target.value as FormState["priority"],
                })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
            >
              <option value="normal">Bình thường</option>
              <option value="important">Quan trọng</option>
              <option value="urgent">Khẩn cấp</option>
            </select>
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Phạm vi dự án
            </span>
            <select
              value={form.projectId}
              onChange={(event) =>
                setForm({ ...form, projectId: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
            >
              <option value="">Toàn hệ thống HVE</option>
              {activeProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.code} — {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isPinned}
              onChange={(event) =>
                setForm({ ...form, isPinned: event.target.checked })
              }
              className="h-4 w-4"
            />
            Ghim bài lên đầu bảng thông báo
          </label>

          {form.type === "meeting" && (
            <>
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Bắt đầu *
                </span>
                <input
                  type="datetime-local"
                  value={form.meetingStartAt}
                  onChange={(event) =>
                    setForm({ ...form, meetingStartAt: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Kết thúc
                </span>
                <input
                  type="datetime-local"
                  value={form.meetingEndAt}
                  onChange={(event) =>
                    setForm({ ...form, meetingEndAt: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Địa điểm
                </span>
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm({ ...form, location: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
                  Đường dẫn họp
                </span>
                <input
                  type="url"
                  value={form.meetingUrl}
                  onChange={(event) =>
                    setForm({ ...form, meetingUrl: event.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
                  placeholder="https://..."
                />
              </label>
            </>
          )}

          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Hẹn giờ đăng
            </span>
            <input
              type="datetime-local"
              value={form.publishedAt}
              onChange={(event) =>
                setForm({ ...form, publishedAt: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
            />
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Ngày hết hạn
            </span>
            <input
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) =>
                setForm({ ...form, expiresAt: event.target.value })
              }
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm"
            />
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">
              Nội dung chi tiết *
            </span>
            <textarea
              value={form.content}
              onChange={(event) =>
                setForm({ ...form, content: event.target.value })
              }
              maxLength={20000}
              rows={12}
              className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-6 outline-none focus:border-blue-500"
              placeholder="Nhập nội dung. Có thể dùng dòng trống và ký hiệu • để chia mục."
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600"
            >
              Hủy chỉnh sửa
            </button>
          )}
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save("draft")}
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-700 disabled:opacity-50"
          >
            Lưu bản nháp
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void save("published")}
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? "Đang lưu..." : "Đăng thông báo"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-black text-slate-900">
            Danh sách thông báo
          </h2>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="draft">Bản nháp</option>
            <option value="published">Đang hiển thị</option>
            <option value="archived">Đã lưu trữ</option>
          </select>
        </div>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Đang tải...
            </p>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Chưa có thông báo nào.
            </p>
          ) : (
            items.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                        {statusLabel(item)}
                      </span>
                      <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                        {item.project?.name || "Toàn hệ thống"}
                      </span>
                      {item.isPinned && (
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                          📌 Đã ghim
                        </span>
                      )}
                    </div>
                    <h3 className="mt-2 font-extrabold text-slate-900">
                      {item.title}
                    </h3>
                    {item.summary && (
                      <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                        {item.summary}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => editItem(item)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Chỉnh sửa
                    </button>
                    {item.status !== "archived" && (
                      <button
                        type="button"
                        onClick={() => void archive(item.id)}
                        className="rounded-lg border border-red-100 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        Lưu trữ
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
