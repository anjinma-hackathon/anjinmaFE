"use client";

import React, { useState } from "react";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";

interface CodeInputFormProps {
  label: string;
  placeholder?: string;
  onSubmit: (code: string) => void;
  buttonText?: string;
  isLoading?: boolean;
}

export const CodeInputForm: React.FC<CodeInputFormProps> = ({
  label,
  placeholder = "코드를 입력하세요",
  onSubmit,
  buttonText = "입장하기",
  isLoading = false,
}) => {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label={label}
        placeholder={placeholder}
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        required
        disabled={isLoading}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isLoading || !code.trim()}
      >
        {isLoading ? "처리 중..." : buttonText}
      </Button>
    </form>
  );
};
