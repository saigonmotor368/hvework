import React, { useState, useEffect } from 'react';
import { type WorkflowTemplate } from '../types';

interface AdminWorkflowViewProps {
  apiBaseUrl: string;
  showToast: (message: string, type?: 'success' | 'error') => void;
}

export const AdminWorkflowView: React.FC<AdminWorkflowViewProps> = ({
  apiBaseUrl,
  showToast,
}) => {
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
  const [selectedType, setSelectedType] = useState<string>('payment_request');
  const [steps, setSteps] = useState<Array<{ stepOrder: number; roleRequired: string }>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const availableRoles = [
    { value: 'department_head', label: 'Trưởng bộ phận' },
    { value: 'accountant', label: 'Kế toán' },
    { value: 'legal', label: 'Pháp chế' },
    { value: 'ceo', label: 'CEO' },
    { value: 'it_admin', label: 'IT Admin' },
    { value: 'employee', label: 'Nhân viên' },
  ];

  const fetchWorkflows = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBaseUrl}/workflows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: WorkflowTemplate[] = await res.json();
        setWorkflows(data);
        const current = data.find((w) => w.type === selectedType);
        if (current) {
          setSteps(
            current.steps.map((s) => ({
              stepOrder: s.stepOrder,
              roleRequired: s.roleRequired,
            })),
          );
        }
      } else {
        showToast('Không thể tải danh sách cấu hình quy trình', 'error');
      }
    } catch {
      showToast('Lỗi kết nối máy chủ', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const handleSelectWorkflow = (type: string) => {
    setSelectedType(type);
    const current = workflows.find((w) => w.type === type);
    if (current) {
      setSteps(
        current.steps.map((s) => ({
          stepOrder: s.stepOrder,
          roleRequired: s.roleRequired,
        })),
      );
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...steps];
    const temp = newSteps[index - 1];
    newSteps[index - 1] = newSteps[index];
    newSteps[index] = temp;
    // Re-index stepOrder
    newSteps.forEach((s, idx) => {
      s.stepOrder = idx + 1;
    });
    setSteps(newSteps);
  };

  const handleMoveDown = (index: number) => {
    if (index === steps.length - 1) return;
    const newSteps = [...steps];
    const temp = newSteps[index + 1];
    newSteps[index + 1] = newSteps[index];
    newSteps[index] = temp;
    // Re-index stepOrder
    newSteps.forEach((s, idx) => {
      s.stepOrder = idx + 1;
    });
    setSteps(newSteps);
  };

  const handleRoleChange = (index: number, newRole: string) => {
    const newSteps = [...steps];
    newSteps[index].roleRequired = newRole;
    setSteps(newSteps);
  };

  const handleAddStep = () => {
    const newSteps = [
      ...steps,
      {
        stepOrder: steps.length + 1,
        roleRequired: 'department_head',
      },
    ];
    setSteps(newSteps);
  };

  const handleDeleteStep = (index: number) => {
    if (steps.length <= 1) {
      showToast('Quy trình duyệt cần có tối thiểu 1 cấp phê duyệt', 'error');
      return;
    }
    const newSteps = steps.filter((_, idx) => idx !== index);
    newSteps.forEach((s, idx) => {
      s.stepOrder = idx + 1;
    });
    setSteps(newSteps);
  };

  const handleSave = async () => {
    if (steps.length === 0) {
      showToast('Quy trình duyệt phải có ít nhất 1 bước', 'error');
      return;
    }

    setIsSaving(true);
    const token = localStorage.getItem('access_token');
    try {
      const res = await fetch(`${apiBaseUrl}/workflows/${selectedType}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ steps }),
      });

      if (res.ok) {
        const updated = await res.json();
        showToast('Cập nhật cấu hình quy trình thành công!');
        // Update local list
        setWorkflows(
          workflows.map((w) => (w.type === selectedType ? updated : w)),
        );
      } else {
        const err = await res.json();
        showToast(err.message || 'Lỗi lưu cấu hình', 'error');
      }
    } catch {
      showToast('Lỗi kết nối khi lưu quy trình', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const currentWf = workflows.find((w) => w.type === selectedType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <span className="mr-2.5">⚙️</span> Quản lý Cấu hình Quy trình Phê duyệt
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Điều chỉnh số cấp, thứ tự và vai trò phê duyệt trực tiếp cho từng loại hồ sơ nghiệp vụ
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || isLoading}
          className="px-5 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
        >
          {isSaving ? 'Đang lưu...' : '💾 Lưu cấu hình quy trình'}
        </button>
      </div>

      {/* Workflow Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={() => handleSelectWorkflow('payment_request')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedType === 'payment_request'
              ? 'bg-blue-50/50 border-[#0A66C2] ring-2 ring-[#0A66C2]/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xl mb-1">💳</div>
          <div className="font-bold text-sm text-gray-900">Đề nghị thanh toán</div>
          <div className="text-xs text-gray-500 mt-0.5">Mã DNTT-YYYY-NNN</div>
        </button>

        <button
          onClick={() => handleSelectWorkflow('proposal')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedType === 'proposal'
              ? 'bg-purple-50/50 border-purple-600 ring-2 ring-purple-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xl mb-1">💡</div>
          <div className="font-bold text-sm text-gray-900">Đề xuất / Kiến nghị</div>
          <div className="text-xs text-gray-500 mt-0.5">Mã DX-YYYY-NNN</div>
        </button>

        <button
          onClick={() => handleSelectWorkflow('contract')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedType === 'contract'
              ? 'bg-amber-50/50 border-amber-600 ring-2 ring-amber-600/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-xl mb-1">📜</div>
          <div className="font-bold text-sm text-gray-900">Hợp đồng kinh tế</div>
          <div className="text-xs text-gray-500 mt-0.5">Mã HD-YYYY-NNN</div>
        </button>
      </div>

      {/* Step Config Canvas */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
          <div>
            <h4 className="text-base font-bold text-gray-900">
              {currentWf?.name || 'Cấu hình các cấp duyệt'}
            </h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Hồ sơ tạo mới sẽ tự động snapshot theo đúng cấu hình bên dưới khi người tạo bấm gửi duyệt
            </p>
          </div>

          <button
            onClick={handleAddStep}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-gray-700 transition-colors"
          >
            + Thêm cấp duyệt
          </button>
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {/* Step 0 - Creator (Fixed) */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100 text-sm">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
                0
              </div>
              <div>
                <span className="font-bold text-gray-900 block">Cấp 0: Người tạo hồ sơ (Khởi tạo)</span>
                <span className="text-xs text-gray-500">Mặc định bắt buộc — Nhân viên lập hồ sơ</span>
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md">
              Cố định
            </span>
          </div>

          {/* Configurable Steps */}
          {steps.map((step, index) => (
            <div
              key={index}
              className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl bg-white border border-slate-200 shadow-xs gap-3 hover:border-slate-300 transition-all"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#0A66C2] font-bold flex items-center justify-center text-xs">
                  {step.stepOrder}
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                    Cấp phê duyệt {step.stepOrder}
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <label className="text-xs font-medium text-gray-600">Vai trò đảm nhiệm:</label>
                    <select
                      value={step.roleRequired}
                      onChange={(e) => handleRoleChange(index, e.target.value)}
                      className="text-xs font-bold bg-slate-50 border border-gray-200 rounded-lg px-3 py-1.5 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0A66C2]"
                    >
                      {availableRoles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label} ({r.value})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Step ordering buttons */}
              <div className="flex items-center space-x-2 self-end md:self-auto">
                <button
                  type="button"
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="p-1.5 rounded-lg border border-slate-200 text-gray-600 hover:bg-slate-50 text-xs disabled:opacity-30"
                  title="Di chuyển lên"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveDown(index)}
                  disabled={index === steps.length - 1}
                  className="p-1.5 rounded-lg border border-slate-200 text-gray-600 hover:bg-slate-50 text-xs disabled:opacity-30"
                  title="Di chuyển xuống"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteStep(index)}
                  disabled={steps.length <= 1}
                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs disabled:opacity-30"
                  title="Xóa cấp này"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Rule note */}
        <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-900 leading-relaxed">
          <strong>Lưu ý kiến trúc HVE Work:</strong> Khi cập nhật quy trình, các hồ sơ đang trong tiến trình phê duyệt (Chờ duyệt) sẽ tiếp tục hoàn tất theo danh sách cấp duyệt đã được snapshot tại thời điểm gửi duyệt, đảm bảo tính toàn vẹn và không bị đứt gãy luồng xử lý.
        </div>
      </div>
    </div>
  );
};
