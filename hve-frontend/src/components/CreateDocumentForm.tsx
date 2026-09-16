import React from 'react';

interface CreateDocumentFormProps {
  createForm: {
    title: string;
    amount: string;
    receiver: string;
    bankName: string;
    bankAccount: string;
    content: string;
    deadline: string;
    selectedFile: File | null;
  };
  setCreateForm: React.Dispatch<React.SetStateAction<{
    title: string;
    amount: string;
    receiver: string;
    bankName: string;
    bankAccount: string;
    content: string;
    deadline: string;
    selectedFile: File | null;
  }>>;
  isProcessing: boolean;
  onSubmit: (e: React.FormEvent, submitNow: boolean) => void;
  onCancel: () => void;
}

export const CreateDocumentForm: React.FC<CreateDocumentFormProps> = ({
  createForm,
  setCreateForm,
  isProcessing,
  onSubmit,
  onCancel,
}) => {
  return (
    <div className="max-w-3xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <div className="mb-6 pb-6 border-b border-slate-100">
        <h3 className="text-lg font-bold text-gray-900">Tạo Đề Nghị Thanh Toán Mới</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Điền đầy đủ thông tin và đính kèm chứng từ theo mẫu quy định của HVE Work
        </p>
      </div>

      <form className="space-y-6" onSubmit={(e) => onSubmit(e, false)}>
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Tiêu đề đề nghị thanh toán <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="VD: Thanh toán tiền bản quyền phần mềm thiết kế Q3"
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Số tiền thanh toán (VND) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              placeholder="VD: 5000000"
              value={createForm.amount}
              onChange={(e) => setCreateForm({ ...createForm, amount: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-bold text-[#0A66C2] focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
            {createForm.amount && (
              <span className="text-xs text-gray-500 mt-1 block">
                = {Number(createForm.amount).toLocaleString('vi-VN')} đ
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Hạn thanh toán <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={createForm.deadline}
              onChange={(e) => setCreateForm({ ...createForm, deadline: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Đơn vị / Người thụ hưởng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Công ty TNHH ABC"
              value={createForm.receiver}
              onChange={(e) => setCreateForm({ ...createForm, receiver: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Ngân hàng <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: Vietcombank CN Tân Bình"
              value={createForm.bankName}
              onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Số tài khoản <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="VD: 0071001234567"
              value={createForm.bankAccount}
              onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Nội dung thanh toán chi tiết <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            required
            placeholder="Mô tả mục đích chi tiết, căn cứ hợp đồng hoặc thỏa thuận..."
            value={createForm.content}
            onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
            className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
          />
        </div>

        {/* Real Attachment Upload */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            Đính kèm chứng từ / Hóa đơn (PDF, DOCX, XLSX, JPG, PNG - Tối đa 10MB) <span className="text-red-500">*</span>
          </label>
          <div className="mt-1.5 flex items-center space-x-3">
            <input
              type="file"
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setCreateForm({ ...createForm, selectedFile: file });
                }
              }}
              className="text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0A66C2] hover:file:bg-blue-100 cursor-pointer"
            />
            {createForm.selectedFile && (
              <span className="text-xs font-bold text-emerald-600">
                ✓ Đã chọn: {createForm.selectedFile.name} ({Math.round(createForm.selectedFile.size / 1024)} KB)
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl border border-gray-300 text-xs font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {isProcessing ? 'Đang lưu...' : 'Lưu bản nháp'}
          </button>

          <button
            type="button"
            onClick={(e) => onSubmit(e, true)}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50"
          >
            {isProcessing ? 'Đang gửi...' : 'Gửi duyệt ngay →'}
          </button>
        </div>
      </form>
    </div>
  );
};
