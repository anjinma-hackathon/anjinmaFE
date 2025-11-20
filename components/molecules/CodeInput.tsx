"use client";

import React, { useState } from "react";

interface CodeInputProps {
  length?: number;
  onChange?: (code: string) => void;
  onComplete?: (code: string) => void;
}

export const CodeInput: React.FC<CodeInputProps> = ({
  length = 6,
  onChange,
  onComplete,
}) => {
  const [code, setCode] = useState<string[]>(new Array(length).fill(""));

  const handleChange = (index: number, value: string) => {
    // 알파벳과 숫자만 허용 (대문자로 변환)
    const alphanumericValue = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (alphanumericValue.length <= 1) {
      const newCode = [...code];
      newCode[index] = alphanumericValue;
      setCode(newCode);

      const fullCode = newCode.join("");
      onChange?.(fullCode);

      // 자동으로 다음 칸으로 이동
      if (alphanumericValue && index < length - 1) {
        const nextInput = document.getElementById(`code-input-${index + 1}`) as HTMLInputElement;
        nextInput?.focus();
      }

      // 완료 시
      if (fullCode.length === length && !fullCode.includes("")) {
        onComplete?.(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Backspace 처리
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const prevInput = document.getElementById(`code-input-${index - 1}`) as HTMLInputElement;
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    // 알파벳과 숫자만 허용 (대문자로 변환)
    const pastedData = e.clipboardData.getData("text").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, length);
    const newCode = [...code];

    for (let i = 0; i < pastedData.length && i < length; i++) {
      newCode[i] = pastedData[i];
    }

    setCode(newCode);
    const fullCode = newCode.join("");
    onChange?.(fullCode);

    if (fullCode.length === length && !fullCode.includes("")) {
      onComplete?.(fullCode);
    }

    // 마지막 입력된 칸으로 포커스
    const focusIndex = Math.min(pastedData.length, length - 1);
    const input = document.getElementById(`code-input-${focusIndex}`) as HTMLInputElement;
    input?.focus();
  };

  return (
    <div className="flex gap-2 justify-center items-center w-full">
      {code.map((digit, index) => (
        <input
          key={index}
          type="text"
          inputMode="text"
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          className="w-12 h-16 text-center text-2xl border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white shadow-sm hover:border-gray-300 font-semibold text-gray-900 flex-shrink-0"
          maxLength={1}
          id={`code-input-${index}`}
          autoComplete="off"
        />
      ))}
    </div>
  );
};
