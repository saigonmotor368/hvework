const DIGITS = [
  "không",
  "một",
  "hai",
  "ba",
  "bốn",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
];

const readTriple = (value: number, forceHundreds: boolean) => {
  const hundreds = Math.floor(value / 100);
  const tens = Math.floor((value % 100) / 10);
  const units = value % 10;
  const words: string[] = [];

  if (hundreds > 0 || forceHundreds) words.push(`${DIGITS[hundreds]} trăm`);
  if (tens > 1) words.push(`${DIGITS[tens]} mươi`);
  else if (tens === 1) words.push("mười");
  else if (units > 0 && (hundreds > 0 || forceHundreds)) words.push("lẻ");

  if (units > 0) {
    if (units === 1 && tens > 1) words.push("mốt");
    else if (units === 4 && tens > 1) words.push("tư");
    else if (units === 5 && tens > 0) words.push("lăm");
    else words.push(DIGITS[units]);
  }
  return words.join(" ");
};

export const amountToVietnameseWords = (rawValue: number) => {
  const value = Math.floor(Math.abs(Number(rawValue) || 0));
  if (value === 0) return "Không đồng";
  const scale = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
  const groups: number[] = [];
  let remaining = value;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  if (groups.length > scale.length) {
    return `${value.toLocaleString("vi-VN")} đồng`;
  }

  const words: string[] = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    const forceHundreds = words.length > 0 && group < 100;
    words.push(readTriple(group, forceHundreds));
    if (scale[index]) words.push(scale[index]);
  }
  const sentence = `${words.join(" ")} đồng`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};
