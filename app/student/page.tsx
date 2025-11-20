"use client";

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, X, Radio, BookOpen, Pencil } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { translations, Language } from '@/utils/translations';
import { toast, Toaster } from 'sonner';
import { ClassRoom } from '@/components/ClassRoom';
import { CodeInput } from '@/components/molecules/CodeInput';
import { joinRoomByCode, getRoomInfo } from '@/utils/api';

interface ClassHistory {
  id: string;
  roomId?: number;
  code: string;
  name: string;
  timestamp: Date;
  isLive: boolean;
  language: string;
}

interface StudentInfo {
  name: string;
  studentId: string;
}

export default function StudentPage() {
  const [history, setHistory] = useState<ClassHistory[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentClass, setCurrentClass] = useState<{ roomId: number; code: string; name: string; language: string; isLive: boolean; wsEndpoint?: string; subscribeUrl?: string; publishUrl?: string } | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('ko');
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [tempStudentName, setTempStudentName] = useState('');
  const [tempStudentId, setTempStudentId] = useState('');
  const [pendingClass, setPendingClass] = useState<{ roomId: number; code: string; name: string; language: string; isLive: boolean; wsEndpoint?: string; subscribeUrl?: string; publishUrl?: string } | null>(null);
  const [currentCode, setCurrentCode] = useState('');

  const t = translations[selectedLanguage];

  useEffect(() => {
    // 클라이언트 사이드에서만 실행
    if (typeof window === 'undefined') return;
    
    // localStorage에서 학생 정보 불러오기
    try {
      const saved = localStorage.getItem('studentInfo');
      if (saved) {
        setStudentInfo(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load student info:', error);
    }
    
    // localStorage에서 히스토리 불러오기
    try {
      const savedHistory = localStorage.getItem('classHistory');
      if (savedHistory) {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      }
    } catch (error) {
      console.error('Failed to load class history:', error);
    }
  }, []);

  // 수업 페이지에 있다면 해당 페이지 렌더링 (hooks 호출 후에 조건부 return)
  if (currentClass && studentInfo) {
    return (
      <ClassRoom 
        roomId={currentClass.roomId}
        classCode={currentClass.code}
        className={currentClass.name}
        language={currentClass.language}
        isLive={currentClass.isLive}
        studentInfo={studentInfo}
        selectedLanguage={selectedLanguage}
        wsEndpoint={currentClass.wsEndpoint}
        subscribeUrl={currentClass.subscribeUrl}
        publishUrl={currentClass.publishUrl}
        onExit={() => setCurrentClass(null)}
      />
    );
  }

  const handleCodeComplete = async (fullCode: string) => {
    try {
      // API: GET /rooms/join?code=xxx - 코드로 입장
      const response = await joinRoomByCode(fullCode);
      
      // 학생 역할인지 확인
      if (response.role !== 'STUDENT') {
        toast.error('학생 코드가 아닙니다.');
        return;
      }
      
      const isLive = true; // TODO: 실제 라이브 상태 확인
      
      // 기존 히스토리에 이미 있는지 확인
      const existingHistory = history.find(item => item.code === fullCode || item.roomId === response.roomId);
      
      if (!existingHistory) {
        const newEntry: ClassHistory = {
          id: Date.now().toString(),
          roomId: response.roomId,
          code: response.studentAuthCode,
          name: response.roomName,
          timestamp: new Date(),
          isLive: isLive,
          language: selectedLanguage
        };
        
        const updatedHistory = [newEntry, ...history];
        setHistory(updatedHistory);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('classHistory', JSON.stringify(updatedHistory));
          } catch (error) {
            console.error('Failed to save class history:', error);
          }
        }
      }
      
      // 방 정보 조회 (WebSocket 정보 포함)
      const roomInfo = await getRoomInfo(response.roomId);
      
      // 입장하려는 수업 정보를 먼저 설정
      const classToEnter = { 
        roomId: roomInfo.roomId,
        code: fullCode, // 입력한 전체 코드 사용 (studentAuthCode가 아닌 입력한 코드)
        name: roomInfo.roomName, 
        language: selectedLanguage, 
        isLive: isLive,
        wsEndpoint: roomInfo.wsEndpoint,
        subscribeUrl: roomInfo.subscribeUrl,
        publishUrl: roomInfo.publishUrl,
      };
      console.log("[StudentPage] Setting pending class:", classToEnter);
      setPendingClass(classToEnter);
      
      // 기존에 입력한 학생 정보가 있으면 기본값으로 설정
      if (studentInfo?.name && studentInfo?.studentId) {
        setTempStudentName(studentInfo.name);
        setTempStudentId(studentInfo.studentId);
      } else {
        // 없으면 빈 값으로
        setTempStudentName('');
        setTempStudentId('');
      }
      
      // 항상 학생 정보 입력 다이얼로그 표시
      setShowStudentDialog(true);
    } catch (error) {
      console.error('Failed to join room:', error);
      toast.error('방 입장에 실패했습니다. 코드를 확인해주세요.');
    }
  };

  const handleCodeChange = (fullCode: string) => {
    setCurrentCode(fullCode);
  };

  const handleDelete = (id: string) => {
    const updated = history.filter(item => item.id !== id);
    setHistory(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('classHistory', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save class history:', error);
      }
    }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const saveEdit = (id: string) => {
    const updated = history.map(item => 
      item.id === id ? { ...item, name: editingName } : item
    );
    setHistory(updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('classHistory', JSON.stringify(updated));
      } catch (error) {
        console.error('Failed to save class history:', error);
      }
    }
    setEditingId(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDoubleClick = async (item: ClassHistory) => {
    if (!item.isLive) {
      toast.error(t.cannotEnter);
      return;
    }
    
    try {
      // roomId가 있으면 방 정보 조회, 없으면 코드로 입장
      let roomInfo;
      if (item.roomId) {
        // API: GET /rooms/{roomId} - 방 정보 조회
        roomInfo = await getRoomInfo(item.roomId);
      } else {
        // API: GET /rooms/join?code=xxx - 코드로 입장
        const joinResponse = await joinRoomByCode(item.code);
        roomInfo = {
          roomId: joinResponse.roomId,
          roomName: joinResponse.roomName,
          studentAuthCode: joinResponse.studentAuthCode,
        };
      }
      
      const classToEnter = { 
        roomId: roomInfo.roomId,
        code: roomInfo.studentAuthCode, 
        name: roomInfo.roomName, 
        language: item.language, 
        isLive: item.isLive,
        wsEndpoint: roomInfo.wsEndpoint,
        subscribeUrl: roomInfo.subscribeUrl,
        publishUrl: roomInfo.publishUrl,
      };
      setPendingClass(classToEnter);
      
      // 기존에 입력한 학생 정보가 있으면 기본값으로 설정
      if (studentInfo?.name && studentInfo?.studentId) {
        setTempStudentName(studentInfo.name);
        setTempStudentId(studentInfo.studentId);
      } else {
        // 없으면 빈 값으로
        setTempStudentName('');
        setTempStudentId('');
      }
      
      // 항상 학생 정보 입력 다이얼로그 표시
      setShowStudentDialog(true);
    } catch (error) {
      console.error('Failed to load room info:', error);
      toast.error('방 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tempStudentName.trim() || !tempStudentId.trim()) {
      toast.error('이름과 학번을 모두 입력해주세요.');
      return;
    }
    
    if (!pendingClass) {
      toast.error('수업 정보를 찾을 수 없습니다.');
      return;
    }
    
    // TODO: 학생 정보를 백엔드에 등록하는 API 호출 필요
    // await registerStudent(pendingClass.roomId, { name: tempStudentName.trim(), studentId: tempStudentId.trim() });
    
    const newStudentInfo: StudentInfo = {
      name: tempStudentName.trim(),
      studentId: tempStudentId.trim()
    };
    
    setStudentInfo(newStudentInfo);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('studentInfo', JSON.stringify(newStudentInfo));
      } catch (error) {
        console.error('Failed to save student info:', error);
        toast.error('학생 정보 저장에 실패했습니다.');
      }
    }
    
    // 입력 필드 초기화
    setTempStudentName('');
    setTempStudentId('');
    
    // 다이얼로그 닫기
    setShowStudentDialog(false);
    
    // 수업 페이지로 이동
    if (pendingClass) {
      console.log("[StudentPage] Setting current class:", pendingClass);
      setCurrentClass(pendingClass);
    } else {
      console.error("[StudentPage] pendingClass is null, cannot enter class");
      toast.error('수업 정보를 불러올 수 없습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 헤더 */}
      <div className="bg-white shadow-sm px-8 py-5 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl text-gray-900">TransClass 학생용</h1>
          <Select value={selectedLanguage} onValueChange={(val) => setSelectedLanguage(val as Language)}>
            <SelectTrigger className="w-[140px] h-10 border-2 border-indigo-200 focus:border-indigo-400 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="text-base">
              <SelectItem value="ko" className="text-base">KR 한국어</SelectItem>
              <SelectItem value="en" className="text-base">EN English</SelectItem>
              <SelectItem value="zh" className="text-base">CN 中文</SelectItem>
              <SelectItem value="ja" className="text-base">JP 日本語</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* T자 레이아웃 */}
      <div className="flex h-[calc(100vh-81px)]">
        {/* 왼쪽: 접속 히스토리 */}
        <div className="flex-[3] bg-white shadow-sm p-8 overflow-y-auto">
          <div className="inline-block mb-6 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full shadow-md">
            <h2 className="text-white m-0">{t.classHistory}</h2>
          </div>
          
          {history.length === 0 ? (
            <div className="flex items-center justify-center h-[calc(100%-4rem)] text-gray-400">
              <div className="text-center">
                <div className="inline-block p-6 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 mb-4">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
                </div>
                <p>아직 참여한 수업이 없습니다</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <Card 
                  key={item.id} 
                  className="group p-5 hover:shadow-lg transition-all duration-200 border-l-4 border-l-indigo-400 bg-gradient-to-r from-indigo-50/30 via-white to-white hover:from-indigo-50/50 relative overflow-hidden cursor-pointer"
                  onDoubleClick={() => handleDoubleClick(item)}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-100/20 to-transparent rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-md ${
                        item.isLive 
                          ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' 
                          : 'bg-gradient-to-br from-gray-300 to-gray-400'
                      }`}>
                        <BookOpen className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit(item.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            className="flex-1 border-blue-300 focus:border-blue-500 shadow-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => saveEdit(item.id)}
                            className="bg-blue-600 hover:bg-blue-700 shadow-md"
                          >
                            {t.save}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="text-gray-900 mb-1 truncate">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-3 text-gray-400 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {item.timestamp.toLocaleString('ko-KR', {
                                  month: 'long',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-300">
                              <span>•</span>
                              <span className="text-xs">{t.code}: {item.code}</span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.isLive && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-50 to-red-100 text-red-600 rounded-full border border-red-200 shadow-sm">
                          <Radio className="w-3 h-3 fill-current animate-pulse" />
                          <span className="text-sm">{t.live}</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(item.id, item.name);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-600 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* 오른쪽: 코드 입력 */}
        <div className="flex-[2] flex items-center justify-center p-8 bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <h2 className="text-gray-900 mb-2">{t.enterClassCode}</h2>
              <p className="text-gray-500 text-sm">호스트에게 받은 6자리 코드를 입력하세요</p>
            </div>
            
            <div className="space-y-6">
              <div className="flex justify-center">
                <CodeInput
                  length={6}
                  onChange={handleCodeChange}
                  onComplete={handleCodeComplete}
                />
              </div>
              
              <Button 
                onClick={() => {
                  if (currentCode.length === 6) {
                    handleCodeComplete(currentCode);
                  }
                }}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl hover:shadow-blue-300 transition-all"
                disabled={currentCode.length !== 6}
              >
                {t.enter}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 학생 정보 입력 다이얼로그 */}
      <Dialog open={showStudentDialog} onOpenChange={setShowStudentDialog}>
        <DialogContent className="sm:max-w-md z-[100] p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
            <DialogTitle className="text-base font-semibold text-left text-gray-900">{t.studentInfo}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleStudentSubmit} className="px-6 py-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">{t.name}</Label>
              <Input
                id="name"
                type="text"
                value={tempStudentName}
                onChange={(e) => setTempStudentName(e.target.value)}
                className="w-full h-11 border border-gray-300 bg-white rounded-md focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:outline-none"
                placeholder="이름을 입력하세요"
                required
                autoFocus
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="studentId" className="text-sm font-medium text-gray-700">{t.studentId}</Label>
              <Input
                id="studentId"
                type="text"
                value={tempStudentId}
                onChange={(e) => setTempStudentId(e.target.value)}
                className="w-full h-11 border border-gray-300 bg-white rounded-md focus:border-gray-400 focus:ring-1 focus:ring-gray-300 focus:outline-none"
                placeholder="학번을 입력하세요"
                required
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-11 bg-gray-700 hover:bg-gray-800 text-white rounded-md font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
              disabled={!tempStudentName.trim() || !tempStudentId.trim()}
            >
              {t.submit}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* 토스트 알림 */}
      <Toaster />
    </div>
  );
}