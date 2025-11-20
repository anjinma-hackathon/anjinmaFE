import { Room } from "@/components/organisms/RoomList";

const STORAGE_KEY = "student_rooms";

export const getStoredRooms = (): Room[] => {
  if (typeof window === "undefined") return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error("Failed to get stored rooms:", error);
    return [];
  }
};

export const saveRoom = (room: Room): void => {
  if (typeof window === "undefined") return;
  
  try {
    const rooms = getStoredRooms();
    const existingIndex = rooms.findIndex((r) => r.roomId === room.roomId);
    
    if (existingIndex >= 0) {
      rooms[existingIndex] = room;
    } else {
      rooms.push(room);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch (error) {
    console.error("Failed to save room:", error);
  }
};

export const removeRoom = (roomId: string): void => {
  if (typeof window === "undefined") return;
  
  try {
    const rooms = getStoredRooms();
    const filteredRooms = rooms.filter((r) => r.roomId !== roomId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRooms));
  } catch (error) {
    console.error("Failed to remove room:", error);
  }
};
