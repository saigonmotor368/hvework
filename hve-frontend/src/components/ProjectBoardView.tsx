import { useEffect, useRef, useState } from 'react';
import { fetchWithSession } from '../api/client';
import type { ProjectItem } from '../types';

interface BoardMessage {
  id: number;
  content: string;
  createdAt: string;
  mentions?: number[];
  user: { id: number; name: string; email?: string };
}

interface Props {
  apiBaseUrl: string;
  projects: ProjectItem[];
  currentUser: any;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export function ProjectBoardView({ apiBaseUrl, projects, currentUser, showToast }: Props) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    projects[0]?.id ?? null,
  );
  const [messages, setMessages] = useState<BoardMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem('access_token');

  useEffect(() => {
    if (!selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  const loadMessages = async (projectId: number) => {
    setIsLoading(true);
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/projects/${projectId}/board`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Không thể tải bảng tin dự án');
      setMessages(await res.json());
    } catch (error: any) {
      showToast(error.message || 'Không thể tải bảng tin dự án', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) loadMessages(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || !selectedProjectId) return;
    setIsSending(true);
    try {
      const res = await fetchWithSession(`${apiBaseUrl}/projects/${selectedProjectId}/board`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: draft.trim() }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || 'Gửi tin nhắn thất bại');
      setMessages((prev) => [...prev, body]);
      setDraft('');
    } catch (error: any) {
      showToast(error.message || 'Gửi tin nhắn thất bại', 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Bạn chưa thuộc dự án nào nên chưa có bảng tin để tham gia.
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:h-fit">
        <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Dự án
        </p>
        <div className="space-y-1">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => setSelectedProjectId(project.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                selectedProjectId === project.id
                  ? 'bg-blue-50 font-bold text-[#0A66C2]'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                {project.code}
              </span>
              {project.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex h-[65vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <h3 className="font-bold text-slate-900">
            💬 Bảng tin {projects.find((p) => p.id === selectedProjectId)?.name || ''}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Nơi các thành viên dự án trao đổi, thông báo nhanh — không thay thế phê duyệt hồ sơ/công việc.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <p className="text-center text-sm text-slate-400">Đang tải...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-slate-400">Chưa có tin nhắn nào. Hãy là người đầu tiên!</p>
          ) : (
            messages.map((m) => {
              const isMe = m.user.id === currentUser?.id;
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm ${
                    isMe ? 'bg-[#0A66C2] text-white' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {!isMe && (
                      <p className="mb-0.5 text-[11px] font-bold text-[#0A66C2]">{m.user.name}</p>
                    )}
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`mt-1 text-[10px] ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                      {new Date(m.createdAt).toLocaleString('vi-VN')}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={handleSend} className="flex items-center gap-2 border-t border-slate-100 p-3">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nhập tin nhắn..."
            disabled={isSending}
            className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#0A66C2]"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="rounded-xl bg-[#0A66C2] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Gửi
          </button>
        </form>
      </div>
    </div>
  );
}
