"use client";

import { Button } from "./ui/button";
import { ArrowLeft, Radio, Upload, FileText, Languages, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Textarea } from "./ui/textarea";
import { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { translations, Language } from "@/utils/translations";
import {
  initStompClient,
  disconnectStompClient,
  subscribeToChannel,
  getStompClient,
} from "@/utils/stomp";
import { toast, Toaster } from "sonner";

interface ClassRoomProps {
  classCode: string;
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

  const t = translations[language];

  // STOMP WebSocket 연결 및 실시간 번역 텍스트 수신
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isLive || !classCode || !wsEndpoint || !subscribeUrl) {
      console.log("[ClassRoom] Missing WebSocket config:", {
        isLive,
        classCode,
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
        // subscribeUrl로 구독 (연결 완료까지 자동 대기)
        unsubscribe = await subscribeToChannel(subscribeUrl, (message) => {
          try {
            const data = JSON.parse(message.body);
            console.log("[ClassRoom] Received message:", data);

            // 번역된 텍스트 수신
            // 백엔드에서 번역된 텍스트를 보내줌
            // data 형식: { translatedText: "...", targetLanguage: "en" } 또는 { text: "...", translatedText: "...", targetLanguage: "en" }
            if (data.translatedText) {
              // targetLanguage와 현재 선택한 언어가 일치하는 번역만 표시
              const targetLang =
                data.targetLanguage || data.language || language;

              // 언어 코드 정규화 (ko, en, zh, ja 등)
              const normalizedTargetLang = targetLang
                .toLowerCase()
                .split("-")[0];
              const normalizedCurrentLang = language
                .toLowerCase()
                .split("-")[0];

              console.log("[ClassRoom] Received translation:", {
                targetLanguage: normalizedTargetLang,
                currentLanguage: normalizedCurrentLang,
                translatedText: data.translatedText.substring(0, 50) + "...",
              });

              if (
                normalizedTargetLang === normalizedCurrentLang ||
                normalizedTargetLang === language
              ) {
                setTranslatedContent((prev) => {
                  // 이전 내용에 새로운 내용 추가 (줄바꿈 처리)
                  const newContent = prev
                    ? prev + "\n\n" + data.translatedText
                    : data.translatedText;
                  return newContent;
                });
              } else {
                console.log("[ClassRoom] Language mismatch, ignoring:", {
                  target: normalizedTargetLang,
                  current: normalizedCurrentLang,
                });
              }
            } else if (data.text) {
              // 원본 텍스트만 있는 경우 (학생 화면에서는 무시, 백엔드에서 번역 처리 예정)
              console.log(
                "[ClassRoom] Received original text without translation (waiting for backend to translate):",
                data.text.substring(0, 50)
              );
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
      // 주의: 다른 컴포넌트에서 사용 중일 수 있으므로 연결 해제하지 않음
      // disconnectStompClient();
    };
  }, [classCode, isLive, language, wsEndpoint, subscribeUrl, publishUrl]);

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

  const handleTranslate = () => {
    setIsTranslating(true);

    // 번역 시뮬레이션
    setTimeout(() => {
      const mockTranslations: { [key: string]: string } = {
        ko: `[${languageLabels[language]}로 번역됨]\n\n이것은 번역된 PDF 내용의 예시입니다.\n\n1. 서론\n   이 문서는 학습 자료로 제공됩니다.\n\n2. 주요 내용\n   - 핵심 개념 설명\n   - 실습 예제\n   - 참고 자료\n\n3. 결론\n   학습한 내용을 복습하고 실제로 적용해보세요.`,
        en: `[Translated to ${languageLabels[language]}]\n\nThis is an example of translated PDF content.\n\n1. Introduction\n   This document is provided as learning material.\n\n2. Main Content\n   - Key concept explanation\n   - Practice examples\n   - Reference materials\n\n3. Conclusion\n   Review what you've learned and try applying it in practice.`,
        zh: `[翻译成${languageLabels[language]}]\n\n这是翻译后的PDF内容示例。\n\n1. 引言\n   本文档作为学习资料提供。\n\n2. 主要内容\n   - 核心概念说明\n   - 实践示例\n   - 参考资料\n\n3. 结论\n   复习所学内容并尝试实际应用。`,
        ja: `[${languageLabels[language]}に翻訳]\n\nこれは翻訳されたPDFコンテンツの例です。\n\n1. 序論\n   この文書は学習資料として提供されます。\n\n2. 主な内容\n   - コアコンセプトの説明\n   - 実習例\n   - 参考資料\n\n3. 結論\n   学習した内容を復習し、実際に適用してみてください。`,
      };

      setTranslatedContent(mockTranslations[language] || mockTranslations.ko);
      setIsTranslating(false);
    }, 2000);
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
                {t.code}: {classCode}
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
              </Card>
            </div>
          )}
        </div>
      </div>
      <Toaster />
    </div>
  );
}
