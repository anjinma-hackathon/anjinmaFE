"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { toast, Toaster } from "sonner";
import { TeacherRoom } from "@/components/TeacherRoom";
import { createRoom, joinRoomByCode, getRoomInfo } from "@/utils/api";

export default function ProfessorPage() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [lectureName, setLectureName] = useState("");
  const [showLectureDialog, setShowLectureDialog] = useState(false);
  const [enteredCode, setEnteredCode] = useState("");
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRoom, setCurrentRoom] = useState<{
    roomId: number;
    lectureName: string;
    professorCode: string;
    studentCode: string;
    wsEndpoint: string;
    subscribeUrl: string;
    publishUrl: string;
  } | null>(null);
  const router = useRouter();

  const handleStart = () => {
    if (selectedOption === "create") {
      setShowLectureDialog(true);
    } else if (selectedOption === "code") {
      setShowCodeInput(true);
    }
  };

  const handleLectureSubmit = async () => {
    if (!lectureName.trim()) return;

    setIsLoading(true);
    try {
      // API: POST /rooms - 방 생성
      const response = await createRoom({ roomName: lectureName.trim() });
      
      // 방 페이지로 이동
      setCurrentRoom({
        roomId: response.roomId,
        lectureName: response.roomName,
        professorCode: response.professorAuthCode,
        studentCode: response.studentAuthCode,
        wsEndpoint: response.wsEndpoint,
        subscribeUrl: response.subscribeUrl,
        publishUrl: response.publishUrl,
      });
      
      setShowLectureDialog(false);
      setLectureName("");
      setSelectedOption(null);
      toast.success('방이 생성되었습니다.');
    } catch (error) {
      console.error('Failed to create room:', error);
      toast.error('방 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (enteredCode.length !== 6) return;

    setIsLoading(true);
    try {
      // API: GET /rooms/join?code=xxx - 코드로 입장
      const response = await joinRoomByCode(enteredCode);
      
      // 교수 역할인지 확인
      if (response.role !== 'PROFESSOR') {
        toast.error('교수 코드가 아닙니다.');
        setIsLoading(false);
        return;
      }
      
      // 방 정보 조회 (WebSocket 정보 포함)
      const roomInfo = await getRoomInfo(response.roomId);
      
      // 방 페이지로 이동
      setCurrentRoom({
        roomId: roomInfo.roomId,
        lectureName: roomInfo.roomName,
        professorCode: roomInfo.professorAuthCode,
        studentCode: roomInfo.studentAuthCode,
        wsEndpoint: roomInfo.wsEndpoint,
        subscribeUrl: roomInfo.subscribeUrl,
        publishUrl: roomInfo.publishUrl,
      });
      
      setShowCodeInput(false);
      setEnteredCode("");
      setSelectedOption(null);
      toast.success('방에 입장했습니다.');
    } catch (error) {
      console.error('Failed to join room:', error);
      toast.error('방 입장에 실패했습니다. 코드를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  // 방 페이지에 있다면 해당 페이지 렌더링 (hooks 호출 후에 조건부 return)
  if (currentRoom) {
    return (
      <TeacherRoom
        roomId={currentRoom.roomId}
        lectureName={currentRoom.lectureName}
        professorCode={currentRoom.professorCode}
        studentCode={currentRoom.studentCode}
        wsEndpoint={currentRoom.wsEndpoint}
        subscribeUrl={currentRoom.subscribeUrl}
        publishUrl={currentRoom.publishUrl}
        onExit={() => setCurrentRoom(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 왼쪽 위 텍스트 */}
      <div className="p-6 border-b border-slate-300">
        <h1 className="text-2xl text-slate-800">ClassOnAir 교수용</h1>
      </div>

      {/* 가운데 카드 */}
      <div className="flex items-center justify-center min-h-[calc(100vh-120px)]">
        <div className="bg-white rounded-3xl shadow-lg p-10 w-full max-w-lg">
          <div className="text-center mb-8">
            <h2 className="text-3xl text-slate-800 mb-3">ClassOnAir</h2>
            <p className="text-slate-500">옵션을 선택해주세요</p>
          </div>

          {/* 옵션 버튼들 */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={() => setSelectedOption("code")}
              className={`p-8 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
                selectedOption === "code"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                selectedOption === "code"
                  ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-md"
                  : "bg-slate-200"
              }`}>
                <svg className={`w-8 h-8 ${selectedOption === "code" ? "text-white" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
                  <rect x="3" y="13" width="7" height="7" rx="1" strokeWidth="2"/>
                  <rect x="13" y="3" width="7" height="7" rx="1" strokeWidth="2"/>
                  <rect x="13" y="13" width="7" height="7" rx="1" strokeWidth="2"/>
                </svg>
              </div>
              <span className="text-slate-800">코드 들어가기</span>
            </button>

            <button
              onClick={() => setSelectedOption("create")}
              className={`p-8 rounded-2xl border-2 transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
                selectedOption === "create"
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-slate-300 hover:border-slate-400"
              }`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${
                selectedOption === "create"
                  ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-md"
                  : "bg-slate-200"
              }`}>
                <svg className={`w-8 h-8 ${selectedOption === "create" ? "text-white" : "text-slate-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-slate-800">방 만들기</span>
            </button>
          </div>

          {/* 시작하기 버튼 */}
          <Button 
            className="w-full h-12 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
            disabled={!selectedOption}
            onClick={handleStart}
          >
            시작하기
          </Button>
        </div>
      </div>

      {/* 강의 이름 입력 다이얼로그 */}
      <Dialog open={showLectureDialog} onOpenChange={setShowLectureDialog}>
        <DialogContent className="sm:max-w-md z-[100] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-left text-gray-900">강의 이름 입력</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6 space-y-4">
            <Input
              type="text"
              placeholder="강의 이름을 입력하세요"
              value={lectureName}
              onChange={(e) => setLectureName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && lectureName.trim()) {
                  handleLectureSubmit();
                }
              }}
              className="w-full h-11 border border-gray-300 bg-white rounded-md focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:outline-none"
              autoFocus
            />
            <Button 
              className="w-full h-11 bg-gray-700 hover:bg-gray-800 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              disabled={!lectureName.trim() || isLoading}
              onClick={handleLectureSubmit}
            >
              {isLoading ? '생성 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 코드 입력 다이얼로그 */}
      <Dialog open={showCodeInput} onOpenChange={setShowCodeInput}>
        <DialogContent className="sm:max-w-md z-[100] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-left text-gray-900">코드 입력</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-6 space-y-4">
            <Input
              type="text"
              placeholder="6자리 코드를 입력하세요"
              value={enteredCode}
              onChange={(e) => {
                // 알파벳과 숫자만 허용 (대문자로 변환)
                const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
                setEnteredCode(value);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && enteredCode.length === 6) {
                  handleCodeSubmit();
                }
              }}
              className="w-full h-11 text-center text-base tracking-wider border border-gray-300 bg-white rounded-md focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:outline-none"
              maxLength={6}
              autoFocus
            />
            <Button 
              className="w-full h-11 bg-gray-700 hover:bg-gray-800 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              disabled={enteredCode.length !== 6 || isLoading}
              onClick={handleCodeSubmit}
            >
              {isLoading ? '입장 중...' : '확인'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}

