import React from 'react';

export interface CreateFormData {
  type: 'payment_request' | 'proposal' | 'contract';
  title: string;
  // payment_request
  amount: string;
  receiver: string;
  bankName: string;
  bankAccount: string;
  deadline: string;
  // common / proposal
  content: string;
  // contract
  partner: string;
  value: string;
  startDate: string;
  endDate: string;
  manager: string;
  notes: string;
  // file
  selectedFile: File | null;
}

interface CreateDocumentFormProps {
  createForm: CreateFormData;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateFormData>>;
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
      {/* Header */}
      <div className="mb-6 pb-6 border-b border-slate-100">
        <h3 className="text-xl font-bold text-gray-900">Tạo Hồ Sơ Phê Duyệt Mới</h3>
        <p className="text-xs text-gray-500 mt-1">
          Chọn loại hồ sơ nghiệp vụ tương ứng và điền các thông tin theo chuẩn quy trình của Hệ Thống Quản Lý Công Việc
        </p>
      </div>

      {/* Document Type Selector */}
      <div className="mb-8">
        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
          Loại hồ sơ phê duyệt <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setCreateForm({ ...createForm, type: 'payment_request' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              createForm.type === 'payment_request'
                ? 'border-[#0A66C2] bg-blue-50/50 ring-2 ring-[#0A66C2]/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="text-2xl mb-1">💳</div>
            <div className="font-bold text-sm text-gray-900">Đề nghị thanh toán</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Tiền mặt, chi phí, hóa đơn nhà cung cấp</div>
          </button>

          <button
            type="button"
            onClick={() => setCreateForm({ ...createForm, type: 'proposal' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              createForm.type === 'proposal'
                ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="text-2xl mb-1">💡</div>
            <div className="font-bold text-sm text-gray-900">Đề xuất / Kiến nghị</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Đề xuất trang thiết bị, chính sách, nhân sự</div>
          </button>

          <button
            type="button"
            onClick={() => setCreateForm({ ...createForm, type: 'contract' })}
            className={`p-4 rounded-xl border text-left transition-all ${
              createForm.type === 'contract'
                ? 'border-amber-600 bg-amber-50/50 ring-2 ring-amber-600/20'
                : 'border-slate-200 hover:border-slate-300 bg-white'
            }`}
          >
            <div className="text-2xl mb-1">📜</div>
            <div className="font-bold text-sm text-gray-900">Hợp đồng kinh tế</div>
            <div className="text-[11px] text-gray-500 mt-0.5">Dịch vụ, đối tác, bảo trì và theo dõi kỳ hạn</div>
          </button>
        </div>
      </div>

      <form className="space-y-6" onSubmit={(e) => onSubmit(e, false)}>
        {/* Common Title */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            {createForm.type === 'payment_request'
              ? 'Tiêu đề đề nghị thanh toán'
              : createForm.type === 'proposal'
              ? 'Tiêu đề đề xuất'
              : 'Tên hợp đồng'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder={
              createForm.type === 'payment_request'
                ? 'VD: Thanh toán tiền bản quyền phần mềm thiết kế Q3'
                : createForm.type === 'proposal'
                ? 'VD: Đề xuất trang bị màn hình mở rộng cho team IT'
                : 'VD: Hợp đồng cung cấp dịch vụ máy chủ đám mây 2026'
            }
            value={createForm.title}
            onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
            className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
          />
        </div>

        {/* PAYMENT REQUEST FIELDS */}
        {createForm.type === 'payment_request' && (
          <>
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

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Đơn vị / Người thụ hưởng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Công ty TNHH Phần mềm ABC hoặc Nguyễn Văn A"
                value={createForm.receiver}
                onChange={(e) => setCreateForm({ ...createForm, receiver: e.target.value })}
                className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ngân hàng thụ hưởng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Vietcombank, Techcombank..."
                  value={createForm.bankName}
                  onChange={(e) => setCreateForm({ ...createForm, bankName: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Số tài khoản ngân hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: 0071000123456"
                  value={createForm.bankAccount}
                  onChange={(e) => setCreateForm({ ...createForm, bankAccount: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Nội dung đề nghị thanh toán <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={3}
                placeholder="Mô tả chi tiết mục đích chi tiêu và căn cứ chứng từ..."
                value={createForm.content}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>
          </>
        )}

        {/* PROPOSAL FIELDS */}
        {createForm.type === 'proposal' && (
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Nội dung đề xuất / Kiến nghị chi tiết <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={6}
              placeholder="Trình bày lý do, sự cần thiết, mục tiêu và đề xuất cụ thể..."
              value={createForm.content}
              onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
              className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
            />
          </div>
        )}

        {/* CONTRACT FIELDS */}
        {createForm.type === 'contract' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Đối tác ký kết <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="VD: Công ty Cổ phần Công nghệ VNPT"
                  value={createForm.partner}
                  onChange={(e) => setCreateForm({ ...createForm, partner: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Giá trị hợp đồng (VND) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  placeholder="VD: 50000000"
                  value={createForm.value}
                  onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm font-bold text-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                />
                {createForm.value && (
                  <span className="text-xs text-gray-500 mt-1 block">
                    = {Number(createForm.value).toLocaleString('vi-VN')} đ
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ngày hiệu lực <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={createForm.startDate}
                  onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Ngày hết hạn hợp đồng <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={createForm.endDate}
                  onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                  className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Người phụ trách hợp đồng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="VD: Trưởng dự án / Nguyễn Văn A"
                value={createForm.manager}
                onChange={(e) => setCreateForm({ ...createForm, manager: e.target.value })}
                className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Ghi chú điều khoản hợp đồng
              </label>
              <textarea
                rows={2}
                placeholder="Ghi chú thêm về điều khoản thanh toán, bảo hành hoặc phạt chậm..."
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                className="mt-1.5 block w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2] focus:bg-white"
              />
            </div>
          </>
        )}

        {/* ATTACHMENT UPLOAD */}
        <div>
          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
            {createForm.type === 'contract'
              ? 'Tệp Hợp đồng đính kèm (Bắt buộc khi gửi duyệt) *'
              : createForm.type === 'payment_request'
              ? 'Chứng từ / Hóa đơn đính kèm (Bắt buộc khi gửi duyệt) *'
              : 'Tệp tài liệu tham khảo đính kèm (Tùy chọn)'}
          </label>
          <div className="mt-1.5 flex items-center space-x-3">
            <input
              type="file"
              onChange={(e) =>
                setCreateForm({
                  ...createForm,
                  selectedFile: e.target.files ? e.target.files[0] : null,
                })
              }
              className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-[#0A66C2] hover:file:bg-blue-100 cursor-pointer border border-gray-200 rounded-xl p-1 bg-slate-50"
            />
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Hỗ trợ định dạng: PDF, DOCX, XLSX, JPG, PNG (tối đa 10MB)
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            Hủy bỏ
          </button>

          <button
            type="submit"
            disabled={isProcessing}
            className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-slate-50 shadow-sm transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Đang lưu...' : '💾 Lưu bản nháp'}
          </button>

          <button
            type="button"
            onClick={(e) => onSubmit(e, true)}
            disabled={isProcessing}
            className="px-6 py-2.5 rounded-xl bg-[#0A66C2] text-white text-xs font-bold hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
          >
            {isProcessing ? 'Đang xử lý...' : '🚀 Lưu & Gửi duyệt ngay'}
          </button>
        </div>
      </form>
    </div>
  );
};
