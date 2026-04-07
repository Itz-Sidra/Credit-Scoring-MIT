import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { apiClient } from "../services/apiClient";
import { Send, Bot } from "lucide-react";

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || "http://localhost:8000/api";

// Key used for storing chat in sessionStorage
const CHAT_STORAGE_KEY = "adminCopilotChatMessages";

type ChatSender = "user" | "bot";

interface ChatMessage {
  id: number;
  text: string;
  sender: ChatSender;
  timestamp: string; // HH:MM format
}

export function AdminCopilot() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  // Chat state
  const [inputText, setInputText] = useState("");
  const [mode, setMode] = useState<"single" | "compare">("single");
  const [loanCodeA, setLoanCodeA] = useState("");
  const [loanCodeB, setLoanCodeB] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Load messages from sessionStorage on mount
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
      if (stored) {
        const parsed: ChatMessage[] = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
        }
      }
    } catch {
      // ignore corrupted storage
    }
  }, []);

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore storage errors
    }
  }, [messages]);

  // Auto-scroll to bottom on new messages / typing changes
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping]);

  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const canSend = () => {
    if (!inputText.trim()) return false;
    if (mode === "single") {
      return Boolean(loanCodeA.trim());
    }
    return Boolean(loanCodeA.trim() && loanCodeB.trim());
  };

  const handleSend = async () => {
    const trimmed = inputText.trim();
    const codeA = loanCodeA.trim();
    const codeB = loanCodeB.trim();

    if (!trimmed || loading || !canSend()) return;

    setError(null);

    // Build display text for the user bubble
    let displayText = trimmed;
    if (mode === "single" && codeA) {
      displayText = `[${codeA}] ${trimmed}`;
    } else if (mode === "compare" && codeA && codeB) {
      displayText = `[${codeA} vs ${codeB}] ${trimmed}`;
    }

    const timestamp = formatTime();
    const userMessage: ChatMessage = {
      id: Date.now(),
      text: displayText,
      sender: "user",
      timestamp,
    };

    // Show user message immediately
    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    // Build backend query while preserving existing routing logic
    let query = trimmed;
    if (mode === "single" && codeA) {
      query = `For application ${codeA}, ${trimmed}`;
    } else if (mode === "compare" && codeA && codeB) {
      query = `Compare applications ${codeA} and ${codeB}: ${trimmed}`;
    }

    const body: any = {
      query,
      applicationId: codeA || undefined,
    };

    setLoading(true);

    try {
      const response = await apiClient.post(`${API_BASE_URL}/chat`, body);
      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || "Chat request failed");
      }

      const json = await response.json();
      const data = json.data || {};
      const rawAnswer =
        typeof data.answer === "string"
          ? data.answer
          : "No answer returned.";

      // Clean up formatting characters (e.g. long em-dash) for display in chat bubble
      const answerText = rawAnswer.replace(/\u2014/g, "-");

      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        text: answerText,
        sender: "bot",
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (e: any) {
      console.error("Error calling copilot chat:", e);
      setError(e.message || "Something went wrong while contacting Copilot.");

      const botMessage: ChatMessage = {
        id: Date.now() + 1,
        text:
          "Copilot could not answer this question due to an internal error.",
        sender: "bot",
        timestamp: formatTime(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <style>{`
        html { scrollbar-gutter: stable; }
      `}</style>

      {/* Header */}
      <header className="bg-white border-b-[1.5px] border-black flex-shrink-0 z-10 relative">
        <div className="w-full px-6 sm:px-8 md:px-10 lg:px-12">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <img src="/images/download.png" alt="Barclays Logo" className="w-8 h-8 object-contain" />
              <span className="font-black text-xl sm:text-2xl text-black uppercase tracking-tight">
                CREDIT 
              </span>
            </div>
            <nav className="hidden md:flex items-center gap-8 mt-1">
              <button
                onClick={() => navigate("/admin")}
                className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate("/admin/loans")}
                className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600"
              >
                Loans
              </button>
              <button
                onClick={() => navigate("/admin/reports")}
                className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600"
              >
                Audit Log
              </button>
              <button
                onClick={() => navigate("/admin/models")}
                className="text-slate-900 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-600 transition-all pb-1.5 border-b-[3px] border-transparent hover:border-blue-600"
              >
                Models
              </button>
              <button
                onClick={() => navigate("/admin/copilot")}
                className="text-blue-600 font-black uppercase tracking-[0.15em] text-xs hover:text-blue-700 transition-all pb-1.5 border-b-[3px] border-blue-600"
              >
                Chat
              </button>
            </nav>
            <Button
              onClick={() => {
                // Clear session-based chat when admin logs out
                try {
                  if (typeof window !== "undefined") {
                    window.sessionStorage.removeItem(CHAT_STORAGE_KEY);
                  }
                } catch {
                  // ignore storage errors on logout
                }
                logout();
              }}
              variant="outline"
              className="border-[1.5px] border-black text-black bg-white hover:bg-black hover:text-white rounded-none font-black text-xs uppercase tracking-[0.15em] transition-all hover:scale-[1.03]"
            >
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="w-full px-6 sm:px-8 md:px-12 lg:px-16 py-10 flex-1 overflow-y-auto bg-[#fafafa]">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-8 h-full">
          {/* Title / Intro */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                {/* <Sparkles className="w-6 h-6 text-blue-600" /> */}
                <h1 className="text-4xl md:text-5xl font-black text-black tracking-tighter uppercase">
        Chat                </h1>
              </div>
              <p className="text-xs md:text-sm font-black text-slate-600 uppercase tracking-[0.18em]">
                Ask questions about applicants, risk, and portfolio performance.
              </p>
            </div>
            {/* <div className="inline-flex items-center gap-2 border-[1.5px] border-black bg-black text-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
              <BrainCircuit className="w-4 h-4" />
              <span>Barclays Analyst Copilot</span>
            </div> */}
          </div>

          {/* Chat layout */}
          <div className="flex flex-col lg:flex-row gap-6 h-full min-h-[420px]">
            {/* Input column */}
            <div className="w-full lg:w-5/12 lg:h-[520px] flex flex-col border-[1.5px] border-black bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)] gap-4">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-blue-600" />
                <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">
                  Ask a Question
                </span>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend()) {
                      void handleSend();
                    }
                  }
                }}
                placeholder="Example: Explain why this application was rejected or compare two applications."
                className="w-full min-h-[120px] resize-none border-[1.5px] border-black bg-white text-sm text-slate-900 p-3 font-medium placeholder:text-slate-500 focus:outline-none focus:ring-0 focus:border-blue-600"
              />
              <div className="flex flex-col gap-3">
                {/* Loan mode toggle */}
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                    Loan Mode
                  </label>
                  <div className="flex gap-1 rounded-full bg-slate-100 p-1 text-[10px] font-black uppercase tracking-[0.18em]">
                    <button
                      type="button"
                      onClick={() => setMode("single")}
                      className={`px-4 py-1.5 rounded-full transition-colors text-[11px] font-black tracking-[0.18em] uppercase ${
                        mode === "single"
                          ? "bg-black text-white"
                          : "bg-transparent text-slate-700"
                      }`}
                    >
                      Single Loan
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("compare")}
                      className={`px-4 py-1.5 rounded-full transition-colors text-[11px] font-black tracking-[0.18em] uppercase ${
                        mode === "compare"
                          ? "bg-black text-white"
                          : "bg-transparent text-slate-700"
                      }`}
                    >
                      Compare Loans
                    </button>
                  </div>
                </div>

                {/* Conditional loan inputs */}
                <div className="flex flex-col gap-2">
                  {mode === "single" ? (
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                        Loan Code
                      </label>
                      <input
                        type="text"
                        value={loanCodeA}
                        onChange={(e) => setLoanCodeA(e.target.value)}
                        placeholder="e.g. P12 or application ID"
                        className="w-full border-[1.5px] border-black bg-white text-xs text-slate-900 px-3 py-2 font-mono tracking-[0.18em] uppercase placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                          Loan A
                        </label>
                        <input
                          type="text"
                          value={loanCodeA}
                          onChange={(e) => setLoanCodeA(e.target.value)}
                          placeholder="e.g. P12"
                          className="w-full border-[1.5px] border-black bg-white text-xs text-slate-900 px-3 py-2 font-mono tracking-[0.18em] uppercase placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600">
                          Loan B
                        </label>
                        <input
                          type="text"
                          value={loanCodeB}
                          onChange={(e) => setLoanCodeB(e.target.value)}
                          placeholder="e.g. H7"
                          className="w-full border-[1.5px] border-black bg-white text-xs text-slate-900 px-3 py-2 font-mono tracking-[0.18em] uppercase placeholder:text-slate-500 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 font-medium">
                    {/* Use short loan codes (P1, H3...) or full application IDs. For
                    comparisons, Copilot will explain key differences. */}
                  </p>
                </div>
                {error && (
                  <div className="text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-2">
                    {error}
                  </div>
                )}
                <div className="flex justify-end mt-1">
                  <Button
                    onClick={() => void handleSend()}
                    disabled={loading || !canSend()}
                    className="inline-flex items-center gap-2 border-[1.5px] border-black bg-slate-800 text-white rounded-none text-xs font-black uppercase tracking-[0.2em] px-6 py-2 hover:bg-black hover:border-black disabled:opacity-60 disabled:hover:bg-slate-800 disabled:hover:border-black"
                  >
                    <span>{loading ? "Thinking..." : "Send"}</span>
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Output column - chat history (themed to match app) */}
            <div className="w-full lg:w-7/12 lg:h-[520px] flex flex-col border-[1.5px] border-black bg-white text-slate-900 rounded-sm shadow-[4px_4px_0_0_rgba(0,0,0,1)] overflow-hidden">
              {/* Chat header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-black text-white border-b border-black">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-md border border-white/20">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-black tracking-[0.18em] uppercase">Chat</span>
                  {/* <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
                    Online 
                  </span> */}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 bg-slate-50">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-[11px] text-slate-500">
                    <p>
                      Start a conversation by asking about a specific loan or
                      comparing two loans.
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex w-full ${
                        msg.sender === "user" ? "justify-end" : "justify-start"
                      } animate-in fade-in slide-in-from-bottom-1 duration-200`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed shadow-md border border-black/10 whitespace-pre-line ${
                          msg.sender === "user"
                            ? "bg-black text-white rounded-br-sm"
                            : "bg-blue-600/90 text-white rounded-bl-sm"
                        }`}
                      >
                        <div className="font-black uppercase tracking-[0.18em]">{msg.text}</div>
                        <div className="mt-1 text-[9px] text-white/70 text-right font-black tracking-[0.15em]">
                          {msg.timestamp}
                        </div>
                      </div>
                    </div>
                  ))
                )}

                {isTyping && (
                  <div className="flex justify-end text-[10px] text-slate-500 animate-pulse">
                    Bot is typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
