"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Bot, Send, Sparkles, Trash2, X } from "lucide-react";
import { useLocale } from "@/lib/useLocale";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type AiResponse = {
  success?: boolean;
  data?: {
    reply?: string;
  };
  reply?: string;
  message?: string;
};

const STORAGE_KEY = "viresto-ai-assistant-history";

const TEXT = {
  ar: {
    title: "المساعد القانوني الذكي",
    subtitle: "مساعد مساحة العمل القانونية",
    open: "فتح المساعد القانوني الذكي",
    close: "إغلاق المساعد القانوني الذكي",
    placeholder: "اسأل عن الصياغة أو التنظيم أو المتابعة...",
    send: "إرسال",
    loading: "جاري التحليل...",
    noReply: "لم يصل رد من المساعد.",
    error: "حدث خطأ أثناء الاتصال بالمساعد.",
    clear: "مسح المحادثة",
    emptyTitle: "كيف أقدر أساعدك؟",
    emptyText:
      "مساعدة عامة دون وصول تلقائي إلى سجلات المكتب أو القضايا أو المواعيد.",
    hint: "Enter للإرسال، وShift + Enter لسطر جديد",
    suggestions: [
      "اقترح قائمة تحقق للتحضير لاجتماع قانوني",
      "ساعدني في تنظيم مهام يوم عمل",
      "صغ رسالة متابعة مهنية قصيرة",
      "كيف أراجع مستندًا بطريقة منظمة؟",
    ],
  },
  en: {
    title: "AI Legal Assistant",
    subtitle: "Smart legal workspace assistant",
    open: "Open AI legal assistant",
    close: "Close AI legal assistant",
    placeholder: "Ask about drafting, organization...",
    send: "Send",
    loading: "Analyzing...",
    noReply: "The assistant did not return a reply.",
    error: "A connection error occurred.",
    clear: "Clear conversation",
    emptyTitle: "How can I help?",
    emptyText:
      "General assistance without automatic access to office, case, or appointment records.",
    hint: "Enter to send, Shift + Enter for a new line",
    suggestions: [
      "Suggest a checklist for a legal meeting",
      "Help organize a workday task list",
      "Draft a short professional follow-up",
      "How can I review a document systematically?",
    ],
  },
} as const;

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function isValidStoredMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<ChatMessage>;

  return (
    typeof item.id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string"
  );
}

export default function AIAssistant() {
  const { locale, isRtl } = useLocale();
  const t = TEXT[locale];

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [storageReady, setStorageReady] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);

      if (stored) {
        const parsed: unknown = JSON.parse(stored);

        if (Array.isArray(parsed)) {
          setMessages(parsed.filter(isValidStoredMessage).slice(-20));
        }
      }
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    } finally {
      setStorageReady(true);
    }
  }, []);

  useEffect(() => {
    if (!storageReady) return;

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  }, [messages, storageReady]);

  useEffect(() => {
    if (!isOpen) return;

    const timer = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !messagesRef.current) return;

    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [isOpen, messages, loading]);

  useEffect(() => {
    if (!isOpen) return;

    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", closeWithEscape);

    return () => {
      window.removeEventListener("keydown", closeWithEscape);
    };
  }, [isOpen]);

  async function askAI(question = message) {
    const cleanMessage = question.trim();

    if (!cleanMessage || loading) return;

    setMessages((current) => [
      ...current,
      {
        id: createId(),
        role: "user",
        content: cleanMessage,
      },
    ]);

    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: cleanMessage,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => null)) as AiResponse | null;

      if (!response.ok || payload?.success === false) {
        throw new Error(payload?.message || t.error);
      }

      const reply = payload?.data?.reply ?? payload?.reply ?? t.noReply;

      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: createId(),
          role: "assistant",
          content:
            error instanceof Error && error.message ? error.message : t.error,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void askAI();
    }
  }

  function clearConversation() {
    setMessages([]);
    setMessage("");
    sessionStorage.removeItem(STORAGE_KEY);
    textareaRef.current?.focus();
  }

  return (
    <>
      {isOpen && (
        <button
          type="button"
          aria-label={t.close}
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-[90] bg-black/35 backdrop-blur-[1px] sm:hidden"
        />
      )}

      {isOpen && (
        <section
          id="viresto-ai-assistant-panel"
          role="dialog"
          aria-labelledby="viresto-ai-assistant-title"
          dir={isRtl ? "rtl" : "ltr"}
          className={`fixed inset-x-3 bottom-20 z-[100] flex h-[min(640px,calc(100dvh-6rem))] flex-col overflow-hidden rounded-[28px] border sm:inset-x-auto sm:bottom-24 sm:w-[390px] ${
            isRtl ? "sm:left-6" : "sm:right-6"
          }`}
          style={{
            background: "var(--card)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-xl)",
          }}
        >
          <header
            className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3.5"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                style={{
                  background: "var(--green-soft)",
                  color: "var(--text)",
                }}
              >
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0 text-start">
                <h2
                  id="viresto-ai-assistant-title"
                  className="truncate text-sm font-extrabold"
                  style={{ color: "var(--text)" }}
                >
                  {t.title}
                </h2>

                <p
                  className="mt-0.5 truncate text-[11px]"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.subtitle}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={clearConversation}
                  title={t.clear}
                  aria-label={t.clear}
                  className="flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{
                    color: "var(--text-3)",
                    background: "var(--card-2)",
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.close}
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{
                  color: "var(--text-2)",
                  background: "var(--card-2)",
                }}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={messagesRef}
            aria-live="polite"
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
            style={{ background: "var(--card-2)" }}
          >
            {messages.length === 0 && !loading ? (
              <div className="flex min-h-full flex-col items-center justify-center py-4 text-center">
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-3xl"
                  style={{
                    background: "var(--green-soft)",
                    color: "var(--text)",
                  }}
                >
                  <Bot className="h-7 w-7" aria-hidden="true" />
                </span>

                <h3
                  className="mt-4 text-base font-extrabold"
                  style={{ color: "var(--text)" }}
                >
                  {t.emptyTitle}
                </h3>

                <p
                  className="mt-1 max-w-[280px] text-xs leading-6"
                  style={{ color: "var(--text-3)" }}
                >
                  {t.emptyText}
                </p>

                <div className="mt-5 grid w-full gap-2">
                  {t.suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => {
                        setMessage(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="rounded-2xl border px-3 py-2.5 text-start text-xs font-bold"
                      style={{
                        background: "var(--card)",
                        borderColor: "var(--border)",
                        color: "var(--text-2)",
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-start text-sm leading-7 ${
                      item.role === "user" ? "ml-auto" : "mr-auto"
                    }`}
                    style={
                      item.role === "user"
                        ? {
                            background: "var(--sidebar)",
                            color: "var(--sidebar-text)",
                          }
                        : {
                            background: item.isError
                              ? "var(--red-soft)"
                              : "var(--card)",
                            color: item.isError
                              ? "var(--danger)"
                              : "var(--text)",
                            border: "1px solid var(--border)",
                          }
                    }
                  >
                    {item.content}
                  </div>
                ))}

                {loading && (
                  <div
                    className="mr-auto flex max-w-[88%] items-center gap-2 rounded-2xl border px-3.5 py-3 text-xs"
                    style={{
                      background: "var(--card)",
                      borderColor: "var(--border)",
                      color: "var(--text-3)",
                    }}
                  >
                    <span className="spinner" />
                    <span>{t.loading}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className="shrink-0 border-t p-3"
            style={{
              background: "var(--card)",
              borderColor: "var(--border)",
            }}
          >
            <div
              className="flex items-end gap-2 rounded-2xl border p-1.5"
              style={{
                background: "var(--input-bg)",
                borderColor: "var(--border)",
              }}
            >
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t.placeholder}
                dir={isRtl ? "rtl" : "ltr"}
                rows={1}
                maxLength={1000}
                className="max-h-32 min-h-[44px] flex-1 appearance-none resize-none border-0 bg-transparent px-3 py-2.5 text-start text-sm leading-6 outline-none ring-0 placeholder:text-start focus:border-0 focus:outline-none focus:ring-0"
                style={{
                  color: "var(--text)",
                  boxShadow: "none",
                }}
              />

              <button
                type="button"
                onClick={() => void askAI()}
                disabled={loading || !message.trim()}
                aria-label={t.send}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  background: "var(--sidebar)",
                  color: "var(--sidebar-text)",
                }}
              >
                <Send
                  className={`h-5 w-5 ${isRtl ? "-scale-x-100" : ""}`}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="viresto-ai-assistant-panel"
        aria-label={isOpen ? t.close : t.open}
        title={isOpen ? t.close : t.title}
        className={`fixed bottom-4 z-[110] flex h-14 w-14 items-center justify-center rounded-full border transition hover:-translate-y-0.5 sm:bottom-6 ${
          isRtl ? "left-4 sm:left-6" : "right-4 sm:right-6"
        }`}
        style={{
          background: "var(--sidebar)",
          borderColor: "var(--sidebar-hover)",
          color: "var(--sidebar-text)",
          boxShadow: "var(--shadow-xl)",
        }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  );
}
