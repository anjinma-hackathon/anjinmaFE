"use client";

import { Button } from "./ui/button";
import { ArrowLeft, Radio, Mic, MicOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { sendSttText } from "@/utils/api";
import { toast, Toaster } from "sonner";

interface TeacherRoomProps {
  lectureName: string;
  professorCode: string;
  studentCode: string;
  onExit: () => void;
}

export function TeacherRoom({
  lectureName,
  professorCode,
  studentCode,
  onExit,
}: TeacherRoomProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [displayText, setDisplayText] = useState("");
  const [students, setStudents] = useState<
    Array<{ name: string; studentId: string }>
  >([
    { name: "김민수", studentId: "2021001" },
    { name: "이지은", studentId: "2021002" },
    { name: "박준형", studentId: "2021003" },
    { name: "최서연", studentId: "2021004" },
  ]);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");

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
      if (isRecording) {
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
  }, []); // 초기화는 한 번만

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

  // STT 텍스트를 백엔드로 전송
  const sendSttToBackend = async (text: string) => {
    if (!text.trim()) return;

    try {
      await sendSttText({
        studentCode: studentCode,
        text: text,
        language: "ko",
      });
      console.log("STT text sent to backend:", text);
    } catch (error) {
      console.error("Failed to send STT text:", error);
      toast.error("텍스트 전송에 실패했습니다.");
    }
  };

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
                코드: {professorCode}
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
            </div>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
