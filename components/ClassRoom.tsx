"use client";

import { Button } from "./ui/button";
import { ArrowLeft, Radio, Upload, FileText, Languages, X, Download } from "lucide-react";
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
  const [translationProgress, setTranslationProgress] = useState<number | null>(null);
  const [progressToken, setProgressToken] = useState<string | null>(null);
  const [progressUnsubscribe, setProgressUnsubscribe] = useState<(() => void) | null>(null);
  const [isTranslated, setIsTranslated] = useState(false); // 번역 완료 여부

  // ✅ 한/영 문장 버퍼
  const koreanBufferRef = useRef<string>("");  // 현재 진행 중인 한글 문장
  const englishBufferRef = useRef<string>(""); // 현재 진행 중인 영어 문장
  const lastReceivedKrRef = useRef<string>(""); // 마지막으로 받은 한글 텍스트 (중복 방지)
  const lastReceivedEnRef = useRef<string>(""); // 마지막으로 받은 영어 텍스트 (중복 방지)
  const sentenceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // 문장 완성 타이머

  // ✅ 완성된 문장 리스트 (한글/영어 페어)
  const [sentences, setSentences] = useState<{ kr: string; en: string }[]>([]);

  const subscribedChannelsRef = useRef<Set<string>>(new Set()); // 구독한 채널 추적 (이중 구독 방지)
  const lastMessageHashRef = useRef<Map<string, number>>(new Map()); // 메시지 해시 추적 (중복 메시지 방지)
  const initRef = useRef<boolean>(false); // 초기화 가드 (StrictMode 이중 실행 방지)

  const t = translations[language];

  // ✅ 문장 완성 판단 함수 (마침표/물음표/느낌표/… 로 끝나면 한 문장 완료로 봄)
  const isSentenceComplete = (text: string) => {
    return /[.!?…]\s*$/.test(text.trim());
  };

  // ✅ sentences → textarea 표시용 문자열로 변환
  useEffect(() => {
    if (sentences.length === 0) {
      setTranslatedContent("");
      return;
    }

    const content = sentences
      .map((s) => {
        if (s.kr && s.en) return `${s.kr}\n${s.en}`;
        if (s.kr) return s.kr;
        return s.en;
      })
      .join("\n\n");

    setTranslatedContent(content);
  }, [sentences]);

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

    // 이중 초기화 방지 (StrictMode 대응)
    if (initRef.current) {
      console.log("[ClassRoom] Already initialized, skipping duplicate init");
      return;
    }
    initRef.current = true;

    console.log("[ClassRoom] Initializing STOMP client:", {
      wsEndpoint,
      subscribeUrl,
      roomId,
    });

    let unsubscribe: (() => void) | null = null;

    // STOMP 클라이언트 초기화
    initStompClient({
      wsEndpoint,
      subscribeUrl,
      publishUrl: publishUrl || "",
    });

    // ✅ 한/영 버퍼에 새 텍스트를 추가하고,
    //    어느 한쪽이라도 문장 끝나면 sentences에 [한글, 영어] 페어로 추가
    const appendSubtitleChunk = (kr: string, en: string) => {
      // 완전히 동일한 텍스트가 연속으로 들어오면 해당 언어만 무시 (중복 방지)
      let shouldProcessKr = true;
      let shouldProcessEn = true;
      
      if (kr && kr === lastReceivedKrRef.current) {
        console.log("[ClassRoom] Duplicate Korean text, skipping:", kr.substring(0, 30));
        shouldProcessKr = false;
      }
      if (en && en === lastReceivedEnRef.current) {
        console.log("[ClassRoom] Duplicate English text, skipping:", en.substring(0, 30));
        shouldProcessEn = false;
      }

      // 한글 버퍼에 추가 (중복 단어 제거만)
      if (kr && shouldProcessKr) {
        if (koreanBufferRef.current) {
          const buffer = koreanBufferRef.current.trim();
          const newText = kr.trim();
          
          // 단어 단위로 중복 체크
          const bufferWords = buffer.split(/\s+/).filter((w: string) => w.length > 0);
          const newWords = newText.split(/\s+/).filter((w: string) => w.length > 0);
          
          if (bufferWords.length > 0 && newWords.length > 0) {
            // 버퍼의 마지막 부분과 새 텍스트의 시작 부분이 겹치는지 확인
            let overlapCount = 0;
            const maxCheck = Math.min(bufferWords.length, newWords.length);
            
            for (let i = 1; i <= maxCheck; i++) {
              const bufferEnd = bufferWords.slice(-i).join(" ").toLowerCase();
              const newStart = newWords.slice(0, i).join(" ").toLowerCase();
              if (bufferEnd === newStart) {
                overlapCount = i;
              } else {
                break;
              }
            }
            
            if (overlapCount > 0) {
              // 겹치는 부분 제거하고 나머지만 추가
              const remainingWords = newWords.slice(overlapCount);
              if (remainingWords.length > 0) {
                koreanBufferRef.current = buffer + " " + remainingWords.join(" ");
              }
            } else {
              // 겹치지 않으면 추가
              koreanBufferRef.current = buffer + " " + newText;
            }
          } else {
            koreanBufferRef.current = buffer + " " + newText;
          }
        } else {
          koreanBufferRef.current = kr;
        }
        lastReceivedKrRef.current = kr;
      }

      // 영어 버퍼에 추가 (중복 단어 제거만)
      if (en && shouldProcessEn) {
        if (englishBufferRef.current) {
          const buffer = englishBufferRef.current.trim();
          const newText = en.trim();
          
          // 단어 단위로 중복 체크
          const bufferWords = buffer.split(/\s+/).filter((w: string) => w.length > 0);
          const newWords = newText.split(/\s+/).filter((w: string) => w.length > 0);
          
          if (bufferWords.length > 0 && newWords.length > 0) {
            // 버퍼의 마지막 부분과 새 텍스트의 시작 부분이 겹치는지 확인
            let overlapCount = 0;
            const maxCheck = Math.min(bufferWords.length, newWords.length);
            
            for (let i = 1; i <= maxCheck; i++) {
              const bufferEnd = bufferWords.slice(-i).join(" ").toLowerCase();
              const newStart = newWords.slice(0, i).join(" ").toLowerCase();
              if (bufferEnd === newStart) {
                overlapCount = i;
              } else {
                break;
              }
            }
            
            if (overlapCount > 0) {
              // 겹치는 부분 제거하고 나머지만 추가
              const remainingWords = newWords.slice(overlapCount);
              if (remainingWords.length > 0) {
                englishBufferRef.current = buffer + " " + remainingWords.join(" ");
              }
            } else {
              // 겹치지 않으면 추가
              englishBufferRef.current = buffer + " " + newText;
            }
          } else {
            englishBufferRef.current = buffer + " " + newText;
          }
        } else {
          englishBufferRef.current = en;
        }
        lastReceivedEnRef.current = en;
      }

      // 문장 완성 처리 함수
      const completeSentence = () => {
        const finalKr = koreanBufferRef.current.trim();
        const finalEn = englishBufferRef.current.trim();

        if (finalKr || finalEn) {
          setSentences((prev) => {
            // 강화된 중복 체크: 마지막 몇 개 문장과 비교
            const checkCount = Math.min(3, prev.length); // 최근 3개 문장 확인
            const recentSentences = prev.slice(-checkCount);
            
            for (const sentence of recentSentences) {
              // 한글과 영어가 모두 동일하면 스킵
              if (sentence.kr === finalKr && sentence.en === finalEn) {
                console.log("[ClassRoom] Duplicate sentence found in recent sentences, skipping");
                return prev;
              }
              // 한글이 동일하고 영어도 비슷하면 스킵 (영어가 완전히 비어있지 않은 경우)
              if (sentence.kr === finalKr && finalEn && sentence.en && 
                  sentence.en.toLowerCase() === finalEn.toLowerCase()) {
                console.log("[ClassRoom] Duplicate Korean with similar English, skipping");
                return prev;
              }
            }
            
            return [
              ...prev,
              { kr: finalKr, en: finalEn },
            ];
          });
        }

        koreanBufferRef.current = "";
        englishBufferRef.current = "";
        lastReceivedKrRef.current = "";
        lastReceivedEnRef.current = "";
      };

      const krDone =
        koreanBufferRef.current && isSentenceComplete(koreanBufferRef.current);
      const enDone =
        englishBufferRef.current && isSentenceComplete(englishBufferRef.current);

      // 둘 중 하나라도 문장이 끝났으면 즉시 완성
      if (krDone || enDone) {
        // 기존 타이머 취소
        if (sentenceTimeoutRef.current) {
          clearTimeout(sentenceTimeoutRef.current);
          sentenceTimeoutRef.current = null;
        }
        completeSentence();
      } else {
        // 문장 종료 기호가 없으면 타이머 설정 (3초 후 자동 완성)
        // 새로운 텍스트가 들어올 때마다 타이머가 리셋됨
        if (sentenceTimeoutRef.current) {
          clearTimeout(sentenceTimeoutRef.current);
        }
        
        // 버퍼에 내용이 있으면 타이머 시작
        if (koreanBufferRef.current.trim() || englishBufferRef.current.trim()) {
          sentenceTimeoutRef.current = setTimeout(() => {
            // 타이머 실행 시점에 버퍼가 변경되지 않았는지 확인
            const currentKr = koreanBufferRef.current.trim();
            const currentEn = englishBufferRef.current.trim();
            
            if (currentKr || currentEn) {
              console.log("[ClassRoom] Sentence timeout, completing sentence");
              completeSentence();
            }
            
            sentenceTimeoutRef.current = null;
          }, 3000); // 3초 대기
        }
      }
    };

    // STOMP 클라이언트 초기화 및 구독
    const setupSubscription = async () => {
      try {
        // WebSocket 연결 완료 대기
        await waitForConnection(10000);
        console.log("[ClassRoom] WebSocket connection confirmed, sending join message");

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
            console.log("[ClassRoom] Student join message sent to:", attendancePublishUrl, joinMessage);
          } else {
            console.error("[ClassRoom] STOMP client is not connected. Cannot send join message.");
            // 잠시 후 재시도
            setTimeout(() => {
              const retryClient = getStompClient();
              if (retryClient && retryClient.active && (retryClient as any).connected) {
                publishToChannel(attendancePublishUrl, joinMessage);
                console.log("[ClassRoom] Student join message sent (retry) to:", attendancePublishUrl, joinMessage);
              }
            }, 1000);
          }
        }

        // 이중 구독 방지: 이미 구독한 채널이면 무시
        if (subscribedChannelsRef.current.has(subscribeUrl)) {
          console.warn("[ClassRoom] Already subscribed to:", subscribeUrl, "skipping duplicate subscription");
          return;
        }

        console.log("[ClassRoom] Subscribing to:", subscribeUrl);
        subscribedChannelsRef.current.add(subscribeUrl);

        // subscribeUrl로 구독 (연결 완료까지 자동 대기)
        unsubscribe = await subscribeToChannel(subscribeUrl, (message) => {
          // 메시지 중복 방지: 해시 기반 체크
          const messageBody = message.body;
          const messageHash = `${messageBody.length}|${messageBody.substring(0, 50)}`; // 간단한 해시
          const now = Date.now();

          // 같은 해시의 메시지가 1초 이내에 들어오면 무시
          const lastTime = lastMessageHashRef.current.get(messageHash);
          if (lastTime && now - lastTime < 1000) {
            console.log(
              "[ClassRoom] Duplicate message detected (hash), skipping:",
              messageHash.substring(0, 50)
            );
            return;
          }
          lastMessageHashRef.current.set(messageHash, now);

          // 오래된 해시 정리 (메모리 누수 방지)
          if (lastMessageHashRef.current.size > 100) {
            const entries = Array.from(lastMessageHashRef.current.entries());
            entries.sort((a, b) => b[1] - a[1]); // 최신순 정렬
            lastMessageHashRef.current = new Map(entries.slice(0, 50)); // 최신 50개만 유지
          }

          try {
            const data = JSON.parse(message.body);
            console.log("[ClassRoom] Received message:", data);

            // PDF 번역 진행 상황 메시지 처리 (자막 채널에서도 수신 가능한 경우 대비)
            // 주의: 실제로는 /sub/translate/{progressToken}에서만 수신됨
            if (
              data.type &&
              [
                "started",
                "ocr_started",
                "ocr_page",
                "translate_started",
                "translate_page",
                "overlay",
                "completed",
                "error",
              ].includes(data.type)
            ) {
              console.log(
                "[ClassRoom] PDF progress event received in subtitle channel (unexpected):",
                data
              );
              // 이 채널에서는 처리하지 않음 (별도 구독에서 처리)
              return;
            }

            // SubtitleMessage 수신: sourceLanguage, targetLanguage, originalText, translatedText
            if (!data.originalText && !data.translatedText) {
              console.warn("[ClassRoom] No text content in message:", data);
              return;
            }

            const originalText = (data.originalText || "").trim();
            const translatedText = (data.translatedText || "").trim();

            console.log("[ClassRoom] Received subtitle data:", {
              originalText: originalText.substring(0, 50),
              translatedText: translatedText.substring(0, 50),
              targetLanguage: data.targetLanguage,
              currentLanguage: language,
            });

            // targetLanguage가 있으면 언어 확인, 없거나 빈 문자열이면 번역 텍스트 표시
            let displayTranslatedText = translatedText;
            if (data.targetLanguage && data.targetLanguage.trim() !== "") {
              const targetLang = data.targetLanguage.toLowerCase().split("-")[0];
              const normalizedCurrentLang = language.toLowerCase().split("-")[0];

              console.log("[ClassRoom] Language check:", {
                targetLang,
                normalizedCurrentLang,
                hasTranslation: !!translatedText,
              });

              // 언어가 일치하면 번역 텍스트 표시
              if (targetLang === normalizedCurrentLang) {
                displayTranslatedText = translatedText;
              } else {
                // 언어가 불일치해도 번역 텍스트가 있으면 일단 표시
                displayTranslatedText = translatedText;
                console.log(
                  "[ClassRoom] Language mismatch but showing translation:",
                  targetLang,
                  "!=",
                  normalizedCurrentLang
                );
              }
            } else {
              displayTranslatedText = translatedText;
              console.log("[ClassRoom] No targetLanguage, showing translation:", !!translatedText);
            }

            console.log(
              "[ClassRoom] Final displayTranslatedText:",
              displayTranslatedText.substring(0, 50)
            );

            // ✅ 여기에서 한/영 버퍼에 추가하고, 문장 완성되면 sentences에 push
            appendSubtitleChunk(originalText, displayTranslatedText);
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
      console.log("[ClassRoom] Cleaning up WebSocket subscription");
      initRef.current = false; // 초기화 플래그 리셋

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (progressUnsubscribe) {
        progressUnsubscribe();
        setProgressUnsubscribe(null);
      }

      // 구독 채널 추적 정리
      subscribedChannelsRef.current.delete(subscribeUrl);

      // 타이머 정리
      if (sentenceTimeoutRef.current) {
        clearTimeout(sentenceTimeoutRef.current);
        sentenceTimeoutRef.current = null;
      }

      // 남아 있는 버퍼를 마지막 문장으로 정리 (필요하면)
      const remainingKorean = koreanBufferRef.current.trim();
      const remainingEnglish = englishBufferRef.current.trim();
      if (remainingKorean || remainingEnglish) {
        setSentences((prev) => [
          ...prev,
          { kr: remainingKorean, en: remainingEnglish },
        ]);
      }

      koreanBufferRef.current = "";
      englishBufferRef.current = "";
    };
  }, [roomId, isLive, language, wsEndpoint, subscribeUrl, publishUrl, studentInfo, progressUnsubscribe]);

  // 언어 변경 시 번역된 텍스트 재요청 (선택사항)
  useEffect(() => {
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
      setIsTranslated(false); // 새 파일 업로드 시 번역 상태 초기화
      setSentences([]); // 자막 리스트도 같이 초기화
      koreanBufferRef.current = "";
      englishBufferRef.current = "";
    }
  };

  const handleTranslate = async () => {
    if (!pdfFile) {
      toast.error("PDF 파일을 선택해주세요.");
      return;
    }

    if (!wsEndpoint) {
      toast.error("WebSocket 연결이 필요합니다.");
      return;
    }

    setIsTranslating(true);
    setTranslationProgress(0);

    // progressToken 생성 (UUID 형식)
    const progressToken = crypto.randomUUID();
    setProgressToken(progressToken);

    let progressUnsubscribeFn: (() => void) | null = null;

    try {
      // WebSocket 연결 확인
      await waitForConnection(5000);

      // PDF 번역 진행 상황 구독: /sub/translate/{progressToken}
      const progressSubscribeUrl = `/sub/translate/${progressToken}`;
      console.log("[ClassRoom] Subscribing to PDF progress:", progressSubscribeUrl);

      progressUnsubscribeFn = await subscribeToChannel(
        progressSubscribeUrl,
        (message) => {
          try {
            const evt = JSON.parse(message.body);
            console.log("[ClassRoom] PDF translation progress event:", evt);

            // 이벤트 타입에 따라 처리
            switch (evt.type) {
              case "started":
                console.log("[ClassRoom] PDF translation started");
                setTranslationProgress(0);
                toast.info("PDF 번역이 시작되었습니다.");
                break;

              case "ocr_started":
                console.log("[ClassRoom] OCR started");
                toast.info("OCR 처리 중...");
                break;

              case "ocr_page":
                if (evt.current && evt.total) {
                  const progress = Math.round(
                    (evt.current / evt.total) * 30
                  ); // OCR은 30%까지
                  setTranslationProgress(progress);
                  console.log(`[ClassRoom] OCR page ${evt.current}/${evt.total}`);
                }
                break;

              case "translate_started":
                console.log("[ClassRoom] Translation started");
                setTranslationProgress(30);
                toast.info("번역 중...");
                break;

              case "translate_page":
                if (evt.current && evt.total) {
                  // OCR 30% + 번역 60% = 90%까지
                  const progress =
                    30 + Math.round((evt.current / evt.total) * 60);
                  setTranslationProgress(progress);
                  console.log(
                    `[ClassRoom] Translate page ${evt.current}/${evt.total}`
                  );
                }
                break;

              case "overlay":
                console.log("[ClassRoom] PDF overlay (synthesizing)");
                setTranslationProgress(90);
                toast.info("PDF 합성 중...");
                break;

              case "completed":
                console.log("[ClassRoom] PDF translation completed");
                setTranslationProgress(100);
                toast.success("PDF 번역이 완료되었습니다.");
                // 구독 해제
                if (progressUnsubscribeFn) {
                  progressUnsubscribeFn();
                  progressUnsubscribeFn = null;
                }
                break;

              case "error":
                console.error(
                  "[ClassRoom] PDF translation error:",
                  evt.message
                );
                toast.error(
                  evt.message || "PDF 번역 중 오류가 발생했습니다."
                );
                setTranslationProgress(null);
                setIsTranslating(false);
                // 구독 해제
                if (progressUnsubscribeFn) {
                  progressUnsubscribeFn();
                  progressUnsubscribeFn = null;
                }
                return; // 에러 시 함수 종료

              default:
                console.log(
                  "[ClassRoom] Unknown progress event type:",
                  evt.type
                );
            }
          } catch (error) {
            console.error("[ClassRoom] Failed to parse progress event:", error);
          }
        }
      );

      // PDF 번역 API 호출 (progressToken 포함)
      const translatedPdfBlob = await translatePdf({
        file: pdfFile,
        language: language,
        mode: "chat",
        filename: pdfFile.name.replace(/\.[^/.]+$/, ""), // 확장자 제외
        progressToken: progressToken,
      });

      // 번역된 PDF를 Blob URL로 생성하여 표시
      if (translatedPdfBlob && translatedPdfBlob.size > 0) {
        const translatedPdfUrl = URL.createObjectURL(translatedPdfBlob);

        // 기존 PDF URL이 있으면 해제
        if (pdfUrl) {
          URL.revokeObjectURL(pdfUrl);
        }

        // 번역된 PDF로 교체
        setPdfUrl(translatedPdfUrl);
        setPdfFile(
          new File([translatedPdfBlob], `translated_${pdfFile.name}`, {
            type: "application/pdf",
          })
        );
        setIsTranslated(true); // 번역 완료 표시

        setTranslationProgress(null);
        // completed 이벤트에서 이미 토스트 표시됨
      } else {
        throw new Error("번역된 PDF 파일을 받지 못했습니다.");
      }
    } catch (error) {
      console.error("PDF 번역 실패:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "PDF 번역에 실패했습니다."
      );
      setTranslationProgress(null);
    } finally {
      setIsTranslating(false);
      // 구독 해제
      if (progressUnsubscribeFn) {
        progressUnsubscribeFn();
      }
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
            size="sm"
            onClick={onExit}
            className="hover:bg-gray-100"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
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
              <Textarea
                readOnly
                value={translatedContent}
                placeholder={t.classContent}
                className={`min-h-[600px] resize-none border-2 rounded-xl p-4 text-gray-700 cursor-default ${
                  isDragging && !pdfFile
                    ? "border-indigo-500 bg-indigo-50/50"
                    : "border-gray-200 bg-gray-50"
                }`}
              />
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
                      setIsTranslated(false);
                      setSentences([]);
                      koreanBufferRef.current = "";
                      englishBufferRef.current = "";
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
                  {isTranslating ? (
                    <Button
                      disabled
                      className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white"
                    >
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                      {t.translating}
                    </Button>
                  ) : isTranslated && pdfUrl ? (
                    // 번역 완료 시 다운로드 버튼
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
                      className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      PDF 다운로드
                    </Button>
                  ) : (
                    // 번역 전 번역하기 버튼
                    <Button
                      onClick={handleTranslate}
                      className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white"
                    >
                      <Languages className="w-4 h-4 mr-2" />
                      {t.translateTo}
                      {languageLabels[language]}
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
