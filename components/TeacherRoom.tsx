"use client";

import { Button } from "./ui/button";
import { ArrowLeft, Radio, Mic, MicOff } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { getAttendance } from "@/utils/api";
import { toast, Toaster } from "sonner";
import {
  initStompClient,
  disconnectStompClient,
  publishToChannel,
  getStompClient,
  waitForConnection,
  subscribeToChannel,
} from "@/utils/stomp";

interface TeacherRoomProps {
  roomId: number;
  lectureName: string;
  professorCode: string;
  studentCode: string;
  wsEndpoint: string;
  subscribeUrl: string;
  publishUrl: string;
  onExit: () => void;
}

export function TeacherRoom({
  roomId,
  lectureName,
  professorCode,
  studentCode,
  wsEndpoint,
  subscribeUrl,
  publishUrl,
  onExit,
}: TeacherRoomProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [students, setStudents] = useState<
    Array<{ name: string; studentId: string }>
  >([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const isRecordingRef = useRef(false);
  const subscribedChannelsRef = useRef<Set<string>>(new Set()); // 구독한 채널 추적 (이중 구독 방지)
  const initRef = useRef<boolean>(false); // 초기화 가드 (StrictMode 이중 실행 방지)

  // 학생 목록 조회 (1번 API)
  const fetchStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    try {
      console.log("[TeacherRoom] Fetching students for roomId:", roomId);
      const response = await getAttendance(roomId);
      console.log("[TeacherRoom] Attendance response:", response);
      console.log(
        "[TeacherRoom] Students count:",
        response.students?.length || 0
      );

      if (response.students && response.students.length > 0) {
        const mappedStudents = response.students.map((s) => ({
          name: s.studentName,
          studentId: s.studentId,
        }));
        console.log("[TeacherRoom] Mapped students:", mappedStudents);
        setStudents(mappedStudents);
      } else {
        console.log("[TeacherRoom] No students found");
        setStudents([]);
      }
    } catch (error) {
      console.error("Failed to fetch students:", error);
      setStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  }, [roomId]);

  // 주기적으로 학생 목록 조회 (5초마다)
  useEffect(() => {
    fetchStudents();
    const interval = setInterval(() => {
      fetchStudents();
    }, 5000); // 5초마다 갱신

    return () => clearInterval(interval);
  }, [fetchStudents]);

  // STT 텍스트를 백엔드로 전송 (STOMP WebSocket으로 발행)
  const sendSttToBackend = useCallback(
    (text: string) => {
      if (!text.trim()) return;

      // WebSocket 연결 확인
      if (!wsConnected) {
        console.warn(
          "[TeacherRoom] WebSocket is not connected. Cannot send STT text."
        );
        toast.error(
          "WebSocket 연결이 끊어져 있습니다. 메시지를 전송할 수 없습니다."
        );
        return;
      }

      try {
        // 교수 자막 발행: /pub/lecture/{roomId} (SubtitleMessage 형식)
        // SubtitleMessage: sourceLanguage, targetLanguage, originalText, translatedText
        publishToChannel(publishUrl, {
          sourceLanguage: "ko",
          targetLanguage: "", // 백엔드가 학생별로 처리
          originalText: text,
          translatedText: "", // 백엔드가 번역 처리
        });
        console.log("[TeacherRoom] STT text published:", text);
      } catch (error) {
        console.error("Failed to publish STT text:", error);
        toast.error("텍스트 전송에 실패했습니다.");
      }
    },
    [publishUrl, wsConnected]
  );

  // 텍스트를 실시간으로 문단 단위로 포맷팅하는 함수 (cuckooso 스타일)
  const formatTextWithParagraphs = (
    text: string,
    interimText: string = ""
  ): string => {
    if (!text && !interimText) return "";

    // 최종 텍스트와 중간 텍스트 결합
    let combinedText = text + interimText;
    if (!combinedText.trim()) return "";

    // 연속된 공백을 하나로 통합
    combinedText = combinedText.replace(/\s+/g, " ").trim();

    // 문장 구분자 뒤에 줄바꿈 추가 (마침표, 물음표, 느낌표)
    // 문장 구분자 + 공백 → 문장 구분자 + 줄바꿈 + 공백
    combinedText = combinedText.replace(/([.!?。！？])\s+/g, "$1\n");

    // 문장 구분자 뒤에 공백 없이 문자가 오는 경우에도 줄바꿈 추가
    combinedText = combinedText.replace(/([.!?。！？])([^\s\n])/g, "$1\n$2");

    // 문장 단위로 분리
    const sentences = combinedText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (sentences.length === 0) return combinedText;

    // 실시간으로 문단 구성
    const paragraphs: string[] = [];
    let currentParagraph: string[] = [];
    let sentenceCount = 0;
    let charCount = 0;

    sentences.forEach((sentence, index) => {
      const sentenceLength = sentence.length;

      // 현재 문단에 문장 추가
      currentParagraph.push(sentence);
      sentenceCount++;
      charCount += sentenceLength;

      // 문단 구분 조건:
      // 1. 2개 이상의 문장이 모였을 때
      // 2. 60자 이상의 텍스트가 쌓였을 때
      // 3. 마지막 문장이 아닌 경우
      const shouldBreakParagraph =
        (sentenceCount >= 2 || charCount >= 60) && index < sentences.length - 1;

      if (shouldBreakParagraph) {
        // 현재 문단 저장
        paragraphs.push(currentParagraph.join(" "));
        // 새 문단 시작
        currentParagraph = [];
        sentenceCount = 0;
        charCount = 0;
      }
    });

    // 마지막 문단 처리 (남은 문장들)
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph.join(" "));
    }

    // 문단 사이에 줄바꿈 2개로 구분하여 반환
    return paragraphs.join("\n\n");
  };

  // Web Speech API 초기화
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.error("Speech Recognition API is not supported in this browser");
      toast.error("이 브라우저는 음성 인식을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR"; // 한국어
    recognition.continuous = true; // 연속 인식
    recognition.interimResults = true; // 중간 결과도 받기

    recognition.onstart = () => {
      console.log("Speech recognition started");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = "";
      let finalTranscript = "";

      // 모든 결과 처리
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + " ";
        } else {
          interimTranscript += transcript;
        }
      }

      // 최종 결과가 있으면 텍스트에 추가
      if (finalTranscript) {
        finalTranscriptRef.current += finalTranscript;
        // 백엔드로 STT 텍스트 전송 (포맷팅하지 않은 원본)
        sendSttToBackend(finalTranscript.trim());
      }

      // 실시간으로 포맷팅하여 표시 (최종 + 중간 결과 모두 포함)
      // 중간 결과도 실시간으로 포맷팅되어 문단이 자동으로 정리됨
      const formattedText = formatTextWithParagraphs(
        finalTranscriptRef.current,
        interimTranscript
      );
      setDisplayText(formattedText);

      // 원본 텍스트도 저장 (필요시 사용)
      setCurrentText(finalTranscriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "no-speech") {
        // 음성이 감지되지 않음 (정상적인 경우일 수 있음)
        return;
      }
      toast.error(`음성 인식 오류: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      // 연속 인식 모드이므로 녹음 중이면 다시 시작
      // isRecording 상태를 ref로 참조하여 최신 상태 사용
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch (error) {
          console.error("Failed to restart recognition:", error);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [sendSttToBackend]); // sendSttToBackend 의존성 추가

  // isRecording 상태를 ref로 추적 (recognition.onend에서 사용)
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  // 녹음 상태 변경 시 시작/중지
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isRecording) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error("Failed to start recognition:", error);
        toast.error("음성 인식을 시작할 수 없습니다.");
        setIsRecording(false);
      }
    } else {
      recognitionRef.current.stop();
    }
  }, [isRecording]);

  // STOMP WebSocket 연결 초기화
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 이중 초기화 방지 (StrictMode 대응)
    if (initRef.current) {
      console.log("[TeacherRoom] Already initialized, skipping duplicate init");
      return;
    }
    initRef.current = true;

    console.log("[TeacherRoom] Initializing STOMP client:", {
      wsEndpoint,
      subscribeUrl,
      publishUrl,
      roomId,
    });

    // STOMP 클라이언트 초기화
    const client = initStompClient({
      wsEndpoint,
      subscribeUrl,
      publishUrl,
    });

    let unsubscribe: (() => void) | null = null;

    // 연결 완료 대기 및 구독 설정
    waitForConnection(10000)
      .then(async () => {
        setWsConnected(true);
        console.log("[TeacherRoom] WebSocket connected successfully");
        
        // 학생 입장 명단 구독: ${subscribeUrl}/attendance = /sub/rooms/{roomId}/attendance
        const attendanceSubscribeUrl = `${subscribeUrl}/attendance`;
        if (subscribeUrl) {
          // 이중 구독 방지: 이미 구독한 채널이면 무시
          if (subscribedChannelsRef.current.has(attendanceSubscribeUrl)) {
            console.warn("[TeacherRoom] Already subscribed to:", attendanceSubscribeUrl, "skipping duplicate subscription");
            return;
          }
          
          console.log("[TeacherRoom] Subscribing to:", attendanceSubscribeUrl);
          subscribedChannelsRef.current.add(attendanceSubscribeUrl);
          
          unsubscribe = await subscribeToChannel(attendanceSubscribeUrl, (message) => {
            try {
              const data = JSON.parse(message.body);
              console.log("[TeacherRoom] Received attendance snapshot:", data);
              
              // StudentListMessage 스냅샷 처리 (type: "snapshot", students: StudentJoinMessage[])
              if (data.type === "snapshot" && Array.isArray(data.students)) {
                // 함수형 업데이트로 클로저 문제 해결
                setStudents((prevStudents) => {
                  const previousStudentIds = new Set(prevStudents.map(s => s.studentId));
                  const currentStudentIds = new Set(data.students.map((s: any) => s.studentId));
                  
                  // 이전 목록과 비교하여 신규 추가/제거 감지
                  const newStudents = data.students.filter((s: any) => !previousStudentIds.has(s.studentId));
                  const removedStudents = prevStudents.filter(s => !currentStudentIds.has(s.studentId));
                  
                  // 학생 목록 전체 갱신 (스냅샷 기준)
                  const mappedStudents = data.students.map((s: any) => ({
                    name: s.studentName,
                    studentId: s.studentId,
                  }));
                  
                  // 토스트 알림 (신규 추가/제거만)
                  newStudents.forEach((s: any) => {
                    toast.success(`${s.studentName} 학생이 입장했습니다.`);
                  });
                  removedStudents.forEach((s) => {
                    toast.info(`${s.name} 학생이 퇴장했습니다.`);
                  });
                  
                  return mappedStudents;
                });
              } else {
                console.warn("[TeacherRoom] Invalid snapshot format:", data);
              }
            } catch (error) {
              console.error("[TeacherRoom] Failed to parse attendance message:", error);
            }
          });
          console.log("[TeacherRoom] Subscribed to attendance:", attendanceSubscribeUrl);
        }
      })
      .catch((error) => {
        console.error("[TeacherRoom] WebSocket connection failed:", error);
        setWsConnected(false);
      });

    // 연결 상태 확인을 위한 인터벌 (폴백)
    const checkConnection = () => {
      const isActive = client?.active || false;
      setWsConnected((prev) => {
        if (isActive !== prev) {
          if (isActive) {
            console.log("[TeacherRoom] WebSocket is connected");
          } else {
            console.warn("[TeacherRoom] WebSocket is not connected");
          }
        }
        return isActive;
      });
    };

    // 주기적으로 연결 상태 확인 (2초마다)
    const connectionCheckInterval = setInterval(checkConnection, 2000);

    return () => {
      console.log("[TeacherRoom] Cleaning up WebSocket subscription");
      initRef.current = false; // 초기화 플래그 리셋
      
      // 인터벌 정리
      clearInterval(connectionCheckInterval);
      // 구독 해제
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      
      // 구독 채널 추적 정리
      if (subscribeUrl) {
        const attendanceSubscribeUrl = `${subscribeUrl}/attendance`;
        subscribedChannelsRef.current.delete(attendanceSubscribeUrl);
      }
      
      // 컴포넌트 언마운트 시 연결 해제
      disconnectStompClient();
      setWsConnected(false);
    };
  }, [wsEndpoint, subscribeUrl, publishUrl]);

  const toggleRecording = () => {
    if (!isRecording) {
      // 녹음 시작 (기존 텍스트 유지)
      setIsRecording(true);
      // 기존 텍스트가 있으면 포맷팅 적용하여 표시
      if (finalTranscriptRef.current) {
        const formattedText = formatTextWithParagraphs(
          finalTranscriptRef.current,
          ""
        );
        setDisplayText(formattedText);
      }
      toast.success("녹음이 시작되었습니다.");
    } else {
      // 녹음 중지
      setIsRecording(false);
      // 마지막 중간 결과도 최종 결과에 포함되도록 포맷팅
      if (finalTranscriptRef.current) {
        const formattedText = formatTextWithParagraphs(
          finalTranscriptRef.current,
          ""
        );
        setDisplayText(formattedText);
      }
      toast.info("녹음이 중지되었습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col h-screen overflow-hidden">
      {/* 헤더 */}
      <div className="p-6 border-b border-slate-300 flex items-center justify-between flex-shrink-0 bg-white">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            나가기
          </Button>
          <div>
            <h1 className="text-xl text-slate-800">강의명: {lectureName}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-600">
                교수 코드: {professorCode}
              </span>
              <span className="text-sm text-slate-400">•</span>
              <span className="text-sm text-slate-600">
                학생 코드: {studentCode}
              </span>
              <span className="text-sm text-slate-400">•</span>
              <span
                className={`text-sm ${
                  wsConnected ? "text-green-500" : "text-red-500"
                }`}
              >
                {wsConnected ? "연결됨" : "연결 안됨"}
              </span>
              <span className="text-sm text-slate-400">•</span>
              <span className="text-sm text-red-500">라이브</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-8">
          <div className="text-right">
            <div className="text-base text-slate-600 mb-2">
              교수용 코드:{" "}
              <span className="font-mono tracking-wider text-lg font-semibold">
                {professorCode}
              </span>
            </div>
            <div className="text-base text-slate-600">
              학생용 코드:{" "}
              <span className="font-mono tracking-wider text-lg font-semibold">
                {studentCode}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 녹음 페이지 */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="w-full h-full flex gap-6 max-w-7xl">
          {/* 왼쪽 2/3 - 자막 영역 */}
          <div className="w-2/3 flex flex-col justify-center">
            {/* 자막 표시 영역 */}
            <div
              className="bg-slate-50 rounded-2xl mb-6 flex flex-col p-8"
              style={{ height: "calc(100vh - 280px)" }}
            >
              <div className="flex-1 overflow-y-auto">
                {displayText ? (
                  <div className="text-slate-700 leading-relaxed text-left">
                    {displayText.split("\n\n").map((paragraph, index, arr) => (
                      <p
                        key={index}
                        className="mb-6 last:mb-0 whitespace-pre-wrap text-base"
                        style={{
                          marginBottom: index < arr.length - 1 ? "1.5rem" : "0",
                          lineHeight: "1.8",
                        }}
                      >
                        {paragraph}
                        {index === arr.length - 1 && (
                          <span className="inline-block w-0.5 h-5 bg-slate-700 ml-1 animate-pulse align-middle"></span>
                        )}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-center">
                    {isRecording
                      ? "음성을 인식하고 있습니다..."
                      : "녹음 버튼을 눌러 시작하세요"}
                  </p>
                )}
                {isRecording && displayText && (
                  <div className="mt-4 text-sm text-slate-500 text-center">
                    실시간 인식 중...
                  </div>
                )}
              </div>
            </div>

            {/* 녹음 버튼 */}
            <div className="flex flex-col items-center gap-3 flex-shrink-0">
              <button
                onClick={toggleRecording}
                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg ${
                  isRecording
                    ? "bg-red-500 hover:bg-red-600 animate-pulse"
                    : "bg-red-500 hover:bg-red-600"
                }`}
              >
                {isRecording ? (
                  <div className="w-5 h-5 bg-white rounded-sm"></div>
                ) : (
                  <Mic className="w-8 h-8 text-white" />
                )}
              </button>

              <p className="text-slate-600">
                {isRecording ? "녹음 중..." : "녹음 시작"}
              </p>
            </div>
          </div>

          {/* 오른쪽 1/3 - 학생 목록 */}
          <div
            className="w-1/3 bg-white rounded-2xl shadow-lg flex flex-col"
            style={{ height: "calc(100vh - 280px)" }}
          >
            <div className="p-6 flex-shrink-0 border-b border-slate-200">
              <h2 className="text-lg text-slate-800">참여 학생</h2>
              <p className="text-sm text-slate-500 mt-1">{students.length}명</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingStudents ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">불러오는 중...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-slate-400">참가자가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {students.map((student, index) => (
                    <div
                      key={index}
                      className="bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors"
                    >
                      <p className="text-slate-800">{student.name}</p>
                      <p className="text-sm text-slate-500">
                        {student.studentId}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
