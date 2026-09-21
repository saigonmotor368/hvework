export interface VietQrBank {
  id?: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
}

export const normalizeBankName = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(ngan hang|thuong mai|co phan|tmcp|viet nam|bank)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

export const findMatchingVietQrBank = (
  bankName: string,
  banks: VietQrBank[],
) => {
  const target = normalizeBankName(bankName);
  if (!target) return undefined;

  const matches = banks
    .map((bank) => {
      const aliases = [bank.bin, bank.code, bank.shortName, bank.name]
        .map(normalizeBankName)
        .filter(Boolean);
      const score = Math.max(
        ...aliases.map((alias) => {
          if (target === alias) return 100;
          if (alias.length >= 3 && target.includes(alias)) return 80 + alias.length;
          if (target.length >= 3 && alias.includes(target)) return 60 + target.length;
          return 0;
        }),
      );
      return { bank, score };
    })
    .sort((a, b) => b.score - a.score);
  return matches[0]?.score > 0 ? matches[0].bank : undefined;
};

export const buildVietQrImageUrl = (input: {
  bankBin: string;
  accountNo: string;
  accountName: string;
  amount: number;
  description: string;
}) => {
  const bankBin = input.bankBin.replace(/[^a-zA-Z0-9]/g, "");
  const accountNo = input.accountNo.replace(/[^a-zA-Z0-9]/g, "");
  if (!bankBin || !accountNo || input.amount <= 0) return "";
  const params = new URLSearchParams({
    amount: String(Math.floor(input.amount)),
    addInfo: input.description.slice(0, 50),
    accountName: input.accountName.slice(0, 50),
  });
  return `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact2.png?${params.toString()}`;
};
