"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, useCycle } from "framer-motion";
import { CornerDownRight } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: number;
  role: "user" | "bot";
  content: string;
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

function ErrorBoundary({ children }: { children: React.ReactNode }) {
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setError(null);
  }, []);

  if (error) {
    return (
      <div className="text-red-500 p-4">
        <p>Error rendering chat: {error.message}</p>
      </div>
    );
  }

  try {
    return <>{children}</>;
  } catch (err: any) {
    setError(err);
    return null;
  }
}

export default function ChatBotUI() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPDFJS = async () => {
      if (window.pdfjsLib) return;
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
      };
      document.body.appendChild(script);
    };
    loadPDFJS();
  }, []);

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = async () => {
      const typedarray = new Uint8Array(reader.result as ArrayBuffer);

      try {
        const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
        let textContent = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          textContent += `\n\nPage ${i}:\n${pageText}`;
        }
        console.log("\ud83d\udcc4 Parsed PDF content:\n", textContent);
        setPdfText(textContent);
      } catch (err) {
        console.error("Error parsing PDF:", err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now(),
      role: "user",
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);

    const combinedInput = input + (pdfText ? `\n\n[Uploaded PDF Content]:\n${pdfText}` : "");

    const geminiContents = [
      ...updatedMessages.map((msg) => ({
        role: msg.role === "bot" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      })),
      {
        role: "user",
        parts: [{ text: combinedInput }],
      },
    ];

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=AIzaSyBjfo8UxFuc0voSHF_Trz6sx-I3V-uZ1J0",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-goog-api-key": "AIzaSyBjfo8UxFuc0voSHF_Trz6sx-I3V-uZ1J0",
          },
          body: JSON.stringify({ contents: geminiContents }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMsg = errorBody?.error?.message || `Status ${response.status}`;
        throw new Error(`API request failed: ${errorMsg}`);
      }

      const data = await response.json();
      const botText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || "\u26a0\ufe0f No valid response.";

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: "bot", content: botText }]);
    } catch (err: any) {
      console.error("Gemini API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "bot",
          content: `\u26a0\ufe0f API Error: ${err.message}`,
        },
      ]);
    } finally {
      setIsTyping(false);
      setPdfText("");
      setUploadedFileName(null);
    }
  };

  const [color, cycleColor] = useCycle(
    "bg-blue-600 hover:bg-blue-700",
    "bg-green-600 hover:bg-green-700",
    "bg-pink-600 hover:bg-pink-700",
    "bg-indigo-600 hover:bg-indigo-700"
  );

  useEffect(() => {
    const interval = setInterval(() => {
      cycleColor();
    }, 1800);
    return () => clearInterval(interval);
  }, [cycleColor]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  return (
    <ErrorBoundary>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white px-4 py-6 relative">
        <Card className="w-full max-w-3xl flex flex-col h-[80vh] bg-slate-900/70 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-sm relative">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
            whileHover={{ scale: 1.05 }}
            className="absolute top-4 left-4 text-lg font-extrabold bg-gradient-to-r from-cyan-400 to-purple-500 text-transparent bg-clip-text select-none z-10 cursor-pointer"
          >
            ⌬ NF
          </motion.div>

          <CardContent
            className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
            ref={chatRef}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`rounded-2xl px-5 py-3 w-fit max-w-sm md:max-w-md break-words whitespace-pre-wrap border-2 shadow-lg ${
                    msg.role === "user"
                      ? "text-white border-transparent bg-gradient-to-br from-[#00C6FF] to-[#0072FF]"
                      : "text-black border border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200"
                  }`}
                >
                  <div className="prose prose-sm prose-slate max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                </motion.div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <motion.div
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="rounded-2xl px-5 py-3 w-fit max-w-sm md:max-w-md border-2 shadow-lg text-black border-gray-300 bg-gradient-to-br from-gray-100 to-gray-200"
                >
                  <span className="animate-pulse">🤖 Typing...</span>
                </motion.div>
              </div>
            )}
          </CardContent>

          <div className="p-4 border-t border-slate-800 bg-slate-900/60 space-y-2">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 min-w-0 bg-slate-800/70 text-white border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500"
              />

              <label
                htmlFor="pdf-upload"
                className="cursor-pointer bg-yellow-600 hover:bg-yellow-700 text-white rounded-xl px-4 py-2"
              >
                📎
              </label>
              <input
                id="pdf-upload"
                type="file"
                accept="application/pdf"
                onChange={handlePDFUpload}
                className="hidden"
              />

              <Button
                type="submit"
                className={`${color} text-white rounded-xl px-4 py-2`}
                disabled={isTyping}
              >
                <CornerDownRight className="w-4 h-4" />
              </Button>
            </form>

            {uploadedFileName && (
              <div className="text-sm text-green-400">📄 {uploadedFileName} uploaded</div>
            )}
          </div>
        </Card>
      </div>
    </ErrorBoundary>
  );
}
