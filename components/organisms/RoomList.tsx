"use client";

import React from "react";
import { RoomCard } from "../molecules/RoomCard";

export interface Room {
  roomId: string;
  studentCode: string;
  professor: string;
  subject: string;
}

interface RoomListProps {
  rooms: Room[];
  onRoomClick: (room: Room) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, onRoomClick }) => {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">아직 참여한 수업이 없습니다.</p>
        <p className="text-sm mt-2">오른쪽에서 학생코드를 입력하여 수업에 참여하세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-4">📚 내 수업 목록</h2>
      {rooms.map((room) => (
        <RoomCard
          key={room.roomId}
          professor={room.professor}
          subject={room.subject}
          onClick={() => onRoomClick(room)}
        />
      ))}
    </div>
  );
};
