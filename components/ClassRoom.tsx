"use client";

import { Button } from "./ui/button";
import {
  ArrowLeft,
  Radio,
  Upload,
  FileText,
  Languages,
  X,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { useState, useEffect, useRef } from "react";
import { Card } from "./ui/card";
import { translations, Language } from "@/utils/translations";
import {
  initStompClient,
  disconnectStompClient,
  subscribeToChannel,
  getStompClient,
  publishToChannel,
  waitForConnection,
} from "@/utils/stomp";
import { toast, Toaster } from "sonner";
import { translatePdf } from "@/utils/api";

// 한 글자씩 애니메이션으로 표시하는 컴포넌트
function AnimatedSentence({
  sentence,
  isNew,
}: {
  sentence: string;
  isNew?: boolean;
}) {
  const [displayedChars, setDisplayedChars] = useState(0);

  useEffect(() => {
    // 새 문장이면 애니메이션 시작, 기존 문장이면 즉시 표시
    if (!isNew) {
      setDisplayedChars(sentence.length);
      return;
    }

    setDisplayedChars(0);
    const chars = sentence.split("");
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < chars.length) {
        currentIndex++;
        setDisplayedChars(currentIndex);
      } else {
        clearInterval(interval);
      }
    }, 50); // 각 글자가 50ms 간격으로 나타남 (느린 속도)

    return () => clearInterval(interval);
  }, [sentence, isNew]);

  return (
    <span className="inline-block">
      {sentence.split("").map((char, index) => (
        <span
          key={index}
          className="inline-block"
          style={{
            opacity: index < displayedChars ? 1 : 0,
            transform:
              index < displayedChars ? "translateY(0)" : "translateY(10px)",
            transition:
              "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
            transitionDelay: isNew ? `${index * 0.05}s` : "0s",
          }}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </span>
  );
}

interface ClassRoomProps {
  roomId: number;
  classCode?: string; // 표시용 (선택사항)
  className: string;
  language: string;
  isLive: boolean;
  studentInfo: {
    name: string;
    studentId: string;
  };
  selectedLanguage: Language;
  wsEndpoint?: string;
  subscribeUrl?: string;
  publishUrl?: string;
  onExit: () => void;
}

const languageLabels: { [key: string]: string } = {
  ko: "🇰🇷 한국어",
  en: "🇺🇸 English",
  zh: "🇨🇳 中文",
  ja: "🇯🇵 日本語",
};

export function ClassRoom({
  roomId,
  classCode,
  className,
  language: initialLanguage,
  isLive,
  studentInfo,
  selectedLanguage: initialSelectedLanguage,
  wsEndpoint,
  subscribeUrl,
  publishUrl,
  onExit,
}: ClassRoomProps) {
  const [language, setLanguage] = useState<Language>(initialSelectedLanguage);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedContent, setTranslatedContent] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [translationProgress, setTranslationProgress] = useState<number | null>(
    null
  );
  const [progressToken, setProgressToken] = useState<string | null>(null);
  const [progressUnsubscribe, setProgressUnsubscribe] = useState<
    (() => void) | null
  >(null);

  const t = translations[language];

  // STOMP WebSocket 연결 및 실시간 번역 텍스트 수신
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLive || !roomId || !wsEndpoint || !subscribeUrl) {
      console.log("[ClassRoom] Missing WebSocket config:", {
        isLive,
        roomId,
        wsEndpoint,
        subscribeUrl,
      });
      return;
    }

    console.log("[ClassRoom] Initializing STOMP client:", {
      wsEndpoint,
      subscribeUrl,
    });

    let unsubscribe: (() => void) | null = null;

    // STOMP 클라이언트 초기화
    initStompClient({
      wsEndpoint,
      subscribeUrl,
      publishUrl: publishUrl || "",
    });

    // STOMP 클라이언트 초기화 및 구독
    const setupSubscription = async () => {
      try {
        // WebSocket 연결 완료 대기
        await waitForConnection(10000);
        console.log(
          "[ClassRoom] WebSocket connection confirmed, sending join message"
        );

        // 학생 입장 메시지 전송: /pub/attendance/{roomId} (StudentJoinMessage 형식)
        if (studentInfo) {
          const attendancePublishUrl = `/pub/attendance/${roomId}`; // roomId는 number
          const joinMessage = {
            studentId: studentInfo.studentId,
            studentName: studentInfo.name,
            language: language,
          };

          // 연결이 완료된 후에만 발행
          const client = getStompClient();
          if (client && client.active && (client as any).connected) {
            publishToChannel(attendancePublishUrl, joinMessage);
            console.log(
              "[ClassRoom] Student join message sent to:",
              attendancePublishUrl,
              joinMessage
            );
          } else {
            console.error(
              "[ClassRoom] STOMP client is not connected. Cannot send join message."
            );
            // 잠시 후 재시도
            setTimeout(() => {
              const retryClient = getStompClient();
              if (
                retryClient &&
                retryClient.active &&
                (retryClient as any).connected
              ) {
                publishToChannel(attendancePublishUrl, joinMessage);
                console.log(
                  "[ClassRoom] Student join message sent (retry) to:",
                  attendancePublishUrl,
                  joinMessage
                );
              }
            }, 1000);
          }
        }

        // subscribeUrl로 구독 (연결 완료까지 자동 대기)
        unsubscribe = await subscribeToChannel(subscribeUrl, (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("[ClassRoom] Received message:", data);

            // PDF 번역 진행 상황 메시지 처리
            if (data.type === "progress" && data.progress !== undefined) {
              console.log(
                "[ClassRoom] PDF translation progress:",
                data.progress
              );
              setTranslationProgress(data.progress);
              if (data.progress === 100) {
                toast.success("PDF 번역이 완료되었습니다.");
                setTranslationProgress(null);
              }
              return;
            }

            // PDF 번역 완료 메시지 처리 (Blob URL 포함)
            if (data.type === "pdf_complete" && data.pdfUrl) {
              console.log(
                "[ClassRoom] PDF translation completed, URL:",
                data.pdfUrl
              );
              // 기존 PDF URL이 있으면 해제
              if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
              }
              setPdfUrl(data.pdfUrl);
              setIsTranslating(false);
              setTranslationProgress(null);
              toast.success(
                `${languageLabels[language]}로 번역이 완료되었습니다.`
              );
              return;
            }

            // SubtitleMessage 수신: sourceLanguage, targetLanguage, originalText, translatedText
            // 백엔드가 번역을 처리하여 translatedText를 보내줌
            if (!data.originalText && !data.translatedText) {
              console.warn("[ClassRoom] No text content in message:", data);
              return;
            }

            // translatedText가 있으면 우선 사용 (백엔드가 번역 처리)
            // targetLanguage가 비어있어도 translatedText가 있으면 표시
            let textToDisplay = data.translatedText || data.originalText || "";

            // targetLanguage가 있으면 언어 확인
            if (data.targetLanguage) {
              const targetLang = data.targetLanguage
                .toLowerCase()
                .split("-")[0];
              const normalizedCurrentLang = language
                .toLowerCase()
                .split("-")[0];

              console.log("[ClassRoom] Received subtitle:", {
                targetLanguage: targetLang,
                currentLanguage: normalizedCurrentLang,
                hasTranslation: !!data.translatedText,
                hasOriginal: !!data.originalText,
              });

              // 언어가 일치하면 번역 표시
              if (targetLang === normalizedCurrentLang && data.translatedText) {
                textToDisplay = data.translatedText;
              } else if (data.translatedText) {
                // 언어가 불일치하지만 번역이 있으면 번역 표시 (백엔드가 처리)
                textToDisplay = data.translatedText;
              } else {
                // 번역이 없으면 원본 표시
                textToDisplay = data.originalText || "";
              }
            } else if (data.translatedText) {
              // targetLanguage가 없어도 translatedText가 있으면 표시 (백엔드가 번역 처리)
              textToDisplay = data.translatedText;
              console.log(
                "[ClassRoom] Using translatedText (no targetLanguage specified):",
                textToDisplay.substring(0, 50)
              );
            } else {
              // translatedText도 없으면 originalText 사용
              textToDisplay = data.originalText || "";
              console.log(
                "[ClassRoom] No translation available, using originalText:",
                textToDisplay.substring(0, 50)
              );
            }

            // 메시지 추가 (중복 방지: 마지막 메시지와 같으면 추가하지 않음)
            if (textToDisplay) {
              setTranslatedContent((prev) => {
                // 마지막 메시지와 같으면 추가하지 않음 (중복 방지)
                const lastMessage = prev.split("\n\n").pop() || "";
                if (lastMessage.trim() === textToDisplay.trim()) {
                  console.log(
                    "[ClassRoom] Duplicate message detected, skipping"
                  );
                  return prev;
                }
                const newContent = prev
                  ? prev + "\n\n" + textToDisplay
                  : textToDisplay;
                return newContent;
              });
            }
          } catch (error) {
            console.error("[ClassRoom] Failed to parse message:", error);
          }
        });

        toast.success("실시간 자막에 연결되었습니다.");
      } catch (error) {
        console.error("[ClassRoom] Failed to setup subscription:", error);
        toast.error("실시간 자막 연결에 실패했습니다.");
      }
    };

    // 구독 설정
    setupSubscription();

    // 컴포넌트 언마운트 시 정리
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (progressUnsubscribe) {
        progressUnsubscribe();
        setProgressUnsubscribe(null);
      }
      // 주의: 다른 컴포넌트에서 사용 중일 수 있으므로 연결 해제하지 않음
      // disconnectStompClient();
    };
  }, [
    roomId,
    isLive,
    language,
    wsEndpoint,
    subscribeUrl,
    publishUrl,
    studentInfo,
  ]);

  // 언어 변경 시 번역된 텍스트 재요청 (선택사항)
  useEffect(() => {
    // 언어 변경 시 현재 내용을 클리어할 수도 있음
    // 또는 백엔드에 언어 변경 알림을 보낼 수도 있음
    // 여기서는 내용을 유지하도록 함
  }, [language]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/pdf") {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      setTranslatedContent("");
    }
  };

  const handleTranslate = async () => {
    if (!pdfFile) {
      toast.error("PDF 파일을 선택해주세요.");
      return;
    }

    if (!wsEndpoint || !subscribeUrl) {
      toast.error("WebSocket 연결이 필요합니다.");
      return;
    }

    setIsTranslating(true);
    setTranslationProgress(0);

    try {
      // WebSocket 연결 확인
      await waitForConnection(5000);

      // roomId 사용 (prop에서 받음)

      // PDF 번역 진행 상황 구독: /sub/rooms/{roomId}/translate/progress
      const progressSubscribeUrl = `/sub/rooms/${roomId}/translate/progress`;
      const unsubscribeProgress = await subscribeToChannel(
        progressSubscribeUrl,
        (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("[ClassRoom] PDF translation progress:", data);

            if (data.progress !== undefined) {
              setTranslationProgress(data.progress);
              if (data.progress === 100) {
                toast.success("PDF 번역이 완료되었습니다.");
                setTranslationProgress(null);
                if (unsubscribeProgress) {
                  unsubscribeProgress();
                }
              }
            }

            // PDF 완료 메시지 처리
            if (data.type === "pdf_complete" && data.pdfUrl) {
              if (pdfUrl) {
                URL.revokeObjectURL(pdfUrl);
              }
              setPdfUrl(data.pdfUrl);
              setIsTranslating(false);
              setTranslationProgress(null);
              if (unsubscribeProgress) {
                unsubscribeProgress();
              }
            }
          } catch (error) {
            console.error(
              "[ClassRoom] Failed to parse progress message:",
              error
            );
          }
        }
      );
      setProgressUnsubscribe(() => unsubscribeProgress);

      // PDF 번역 요청 발행: /pub/translate/pdf/{roomId}
      const translatePublishUrl = `/pub/translate/pdf/${roomId}`;
      const progressToken = `pdf_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      setProgressToken(progressToken);

      publishToChannel(translatePublishUrl, {
        filename: pdfFile.name,
        language: language,
        mode: "chat",
        progressToken: progressToken,
      });
      console.log(
        "[ClassRoom] PDF translation request published:",
        translatePublishUrl
      );

      // PDF 파일을 FormData로 전송
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("language", language);
      formData.append("mode", "chat");
      formData.append("filename", pdfFile.name);
      formData.append("progressToken", progressToken);

      // PDF 번역 API 호출 (백엔드가 WebSocket으로 진행 상황을 보내고, 완료 시 PDF를 반환)
      const translatedPdfBlob = await translatePdf({
        file: pdfFile,
        language: language,
        mode: "chat",
        filename: pdfFile.name,
        progressToken: progressToken,
      });

      // WebSocket으로 진행 상황을 받지 못한 경우 폴백: 직접 Blob 처리
      if (translatedPdfBlob && translatedPdfBlob.size > 0) {
        const translatedPdfUrl = URL.createObjectURL(translatedPdfBlob);

        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }

        setPdfUrl(translatedPdfUrl);
        setPdfFile(
          new File([translatedPdfBlob], `translated_${pdfFile.name}`, {
            type: "application/pdf",
          })
        );
        setTranslationProgress(null);
        toast.success(`${languageLabels[language]}로 번역이 완료되었습니다.`);
      }
    } catch (error) {
      console.error("PDF 번역 실패:", error);
      toast.error(
        error instanceof Error ? error.message : "PDF 번역에 실패했습니다."
      );
      setTranslationProgress(null);
    } finally {
      setIsTranslating(false);
      if (progressUnsubscribe) {
        progressUnsubscribe();
        setProgressUnsubscribe(null);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      {/* 헤더 */}
      <div className="bg-white shadow-sm px-8 py-5 backdrop-blur-sm bg-white/80 sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="default"
            onClick={onExit}
            className="hover:bg-gray-100 px-4 py-2"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {t.exit}
          </Button>
          <div className="flex-1">
            <h1 className="text-gray-900">{className}</h1>
            <div className="flex items-center gap-3 text-sm text-gray-500">
              <span>
                {classCode && (
                  <>
                    {t.code}: {classCode}
                  </>
                )}
              </span>
              {isLive && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5 text-red-600">
                    <Radio className="w-3 h-3 fill-current animate-pulse" />
                    <span>{t.live}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 수업 내용 */}
      <div className="max-w-7xl mx-auto p-8">
        <div
          className={`grid gap-6 ${pdfFile ? "grid-cols-3" : "grid-cols-1"}`}
        >
          {/* 수업 내용 영역 */}
          <div className={`${pdfFile ? "col-span-2" : "col-span-1"}`}>
            <div
              className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100"
              onDragOver={!pdfFile ? handleDragOver : undefined}
              onDragLeave={!pdfFile ? handleDragLeave : undefined}
              onDrop={!pdfFile ? handleDrop : undefined}
            >
              <div
                className={`min-h-[600px] border-2 rounded-xl p-6 text-gray-700 cursor-default overflow-y-auto ${
                  isDragging && !pdfFile
                    ? "border-indigo-500 bg-indigo-50/50"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                {translatedContent ? (
                  <div className="space-y-3">
                    {translatedContent
                      .split("\n")
                      .filter((s) => s.trim().length > 0)
                      .map((sentence, index, arr) => {
                        // 마지막 문장인지 확인 (새로 추가된 문장인지 판단)
                        const isLastSentence = index === arr.length - 1;
                        return (
                          <div
                            key={`${sentence}-${index}`}
                            className="text-lg leading-relaxed"
                            style={{
                              animation: `fadeInUp 0.3s ease-out ${Math.min(
                                index * 0.05,
                                1
                              )}s both`,
                            }}
                          >
                            <AnimatedSentence
                              sentence={sentence.trim()}
                              isNew={isLastSentence}
                            />
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-gray-400 text-center mt-20">
                    {t.classContent}
                  </p>
                )}
              </div>
              {!pdfFile && (
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-400 flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" />
                    {t.dragPdf}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PDF 미리보기 영역 */}
          {pdfFile && (
            <div className="col-span-1">
              <Card className="bg-white rounded-2xl shadow-lg p-6 border border-indigo-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-900 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    {t.pdfMaterial}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPdfFile(null);
                      setPdfUrl(null);
                      setTranslatedContent("");
                    }}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {/* PDF 표지 미리보기 */}
                <div className="bg-gray-100 rounded-xl aspect-[3/4] mb-4 flex items-center justify-center overflow-hidden">
                  {pdfUrl ? (
                    <iframe
                      src={`${pdfUrl}#page=1&view=FitH`}
                      className="w-full h-full"
                      title="PDF Preview"
                    />
                  ) : (
                    <FileText className="w-20 h-20 text-gray-400" />
                  )}
                </div>

                <p className="text-sm text-gray-600 mb-3 truncate">
                  {pdfFile.name}
                </p>

                {/* 번역 진행률 표시 */}
                {translationProgress !== null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>번역 진행 중...</span>
                      <span>{translationProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${translationProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Button
                    onClick={handleTranslate}
                    disabled={isTranslating}
                    className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white"
                  >
                    {isTranslating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        {t.translating}
                      </>
                    ) : (
                      <>
                        <Languages className="w-4 h-4 mr-2" />
                        {t.translateTo}
                        {languageLabels[language]}
                      </>
                    )}
                  </Button>

                  {pdfUrl && (
                    <Button
                      onClick={() => {
                        if (pdfUrl && pdfFile) {
                          const link = document.createElement("a");
                          link.href = pdfUrl;
                          link.download = pdfFile.name;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }
                      }}
                      variant="outline"
                      className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF 다운로드
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
