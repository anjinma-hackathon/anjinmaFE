"use client";

import React, { useState } from "react";
import { Input } from "../atoms/Input";
import { Button } from "../atoms/Button";

interface CreateRoomFormProps {
  onSubmit: (professorName: string, subject: string) => void;
  isLoading?: boolean;
}

export const CreateRoomForm: React.FC<CreateRoomFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [professorName, setProfessorName] = useState("");
  const [subject, setSubject] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (professorName.trim() && subject.trim()) {
      onSubmit(professorName.trim(), subject.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="교수 이름"
        placeholder="예: 김철수"
        value={professorName}
        onChange={(e) => setProfessorName(e.target.value)}
        required
        disabled={isLoading}
      />
      <Input
        label="과목명"
        placeholder="예: 경영학원론"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        required
        disabled={isLoading}
      />
      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={isLoading || !professorName.trim() || !subject.trim()}
      >
        {isLoading ? "방 생성 중..." : "방 만들기"}
      </Button>
    </form>
  );
};
