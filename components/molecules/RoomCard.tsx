import React from "react";
import { Card } from "../atoms/Card";

interface RoomCardProps {
  professor: string;
  subject: string;
  onClick: () => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  professor,
  subject,
  onClick,
}) => {
  return (
    <Card
      onClick={onClick}
      className="p-4 hover:border-blue-500 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">📚</div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg text-gray-900">{subject}</h3>
          <p className="text-sm text-gray-600 mt-1">{professor} 교수</p>
        </div>
      </div>
    </Card>
  );
};
