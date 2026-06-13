// src/components/ChatWindow.tsx
import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Pencil,
  Settings,
  Check,
  X,
  SlidersHorizontal,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: string;
  content: string;
  isPinned?: boolean;
  isPruned?: boolean;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
  hasMessages: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onUpdateUserMessage?: (index: number, newContent: string) => void;
  onRegenerateFromCheckpoint?: (
    index: number,
    overrides: {
      temperature: number;
      topP: number;
      frequencyPenalty: number;
      presencePenalty: number;
    },
  ) => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  hasMessages,
  messagesEndRef,
  onUpdateUserMessage,
  onRegenerateFromCheckpoint,
}) => {
  // Local interface tracking states
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const [tuningIdx, setTuningIdx] = useState<number | null>(null);
  const [localTemp, setLocalTemp] = useState(0.7);
  const [localTopP, setLocalTopP] = useState(0.9);
  const [localFreqPenalty, setLocalFreqPenalty] = useState(0.0);
  const [localPresPenalty, setLocalPresPenalty] = useState(0.0);

  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Auto-grow height for active user edit textarea frames
  useEffect(() => {
    if (editingIdx !== null && editTextAreaRef.current) {
      editTextAreaRef.current.style.height = "auto";
      editTextAreaRef.current.style.height = `${editTextAreaRef.current.scrollHeight}px`;
    }
  }, [editContent, editingIdx]);

  // Click outside listener loop to close the hovering tuning overlay cleanly
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;

      // Look for data attributes to identify if the user clicked the active cog button itself
      const clickedToggleButton =
        target instanceof Element &&
        target.closest("[data-tuning-toggle='true']");

      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !clickedToggleButton
      ) {
        setTuningIdx(null);
      }
    };

    if (tuningIdx !== null) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [tuningIdx]);

  const startEditing = (idx: number, currentContent: string) => {
    setEditingIdx(idx);
    setEditContent(currentContent);
    setTuningIdx(null);
  };

  const saveEdit = (idx: number) => {
    if (editContent.trim() && onUpdateUserMessage) {
      onUpdateUserMessage(idx, editContent);
    }
    setEditingIdx(null);
  };

  const startTuning = (e: React.MouseEvent, idx: number, msg: Message) => {
    e.stopPropagation();
    setTuningIdx(tuningIdx === idx ? null : idx);
    setLocalTemp(msg.temperature ?? 0.7);
    setLocalTopP(msg.topP ?? 0.9);
    setLocalFreqPenalty(msg.frequencyPenalty ?? 0.0);
    setLocalPresPenalty(msg.presencePenalty ?? 0.0);
    setEditingIdx(null);
  };

  const executeRegeneration = (idx: number) => {
    if (onRegenerateFromCheckpoint) {
      onRegenerateFromCheckpoint(idx, {
        temperature: localTemp,
        topP: localTopP,
        frequencyPenalty: localFreqPenalty,
        presencePenalty: localPresPenalty,
      });
    }
    setTuningIdx(null);
  };

  return (
    <main className="flex-1 overflow-y-auto p-6 bg-theme-bg transition-colors duration-200">
      <div className="max-w-3xl w-full mx-auto space-y-6 flex flex-col">
        {!hasMessages ? (
          /* ================= EMPTY STATE CANVAS ================= */
          <div className="flex h-[70vh] flex-col items-center justify-center text-theme-muted space-y-3 text-center select-none">
            <div className="h-12 w-12 rounded-2xl bg-theme-panel border border-theme-border flex items-center justify-center text-theme-accent font-bold text-lg shadow-sm">
              <Zap className="w-4 h-4 fill-theme-accent/10 stroke-[2.5]" />
            </div>
            <div>
              <p className="text-base font-medium text-theme-text">
                Promptly is offline-ready.
              </p>
              <p className="text-xs text-theme-muted max-w-xs mt-1">
                Select an active model from your system configuration menu above
                to begin a session.
              </p>
            </div>
          </div>
        ) : (
          /* ================= VIRTUALIZED CONVERSATION PIPELINE ================= */
          messages.map((msg, idx) => (
            <ObservedMessageItem
              key={idx}
              msg={msg}
              idx={idx}
              isLoading={isLoading}
              isEditing={editingIdx === idx}
              isTuning={tuningIdx === idx}
              editContent={editContent}
              setEditContent={setEditContent}
              editTextAreaRef={editTextAreaRef}
              popoverRef={popoverRef}
              localTemp={localTemp}
              setLocalTemp={setLocalTemp}
              localTopP={localTopP}
              setLocalTopP={setLocalTopP}
              localFreqPenalty={localFreqPenalty}
              setLocalFreqPenalty={setLocalFreqPenalty}
              localPresPenalty={localPresPenalty}
              setLocalPresPenalty={setLocalPresPenalty}
              startEditing={startEditing}
              saveEdit={saveEdit}
              setEditingIdx={setEditingIdx}
              startTuning={startTuning}
              executeRegeneration={executeRegeneration}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </main>
  );
};

/* ================= HARDWARE-ACCELERATED OBSERVER NODE ================= */
interface ObservedItemProps {
  msg: Message;
  idx: number;
  isLoading: boolean;
  isEditing: boolean;
  isTuning: boolean;
  editContent: string;
  setEditContent: (val: string) => void;
  editTextAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  popoverRef: React.RefObject<HTMLDivElement | null>;
  localTemp: number;
  setLocalTemp: (val: number) => void;
  localTopP: number;
  setLocalTopP: (val: number) => void;
  localFreqPenalty: number;
  setLocalFreqPenalty: (val: number) => void;
  localPresPenalty: number;
  setLocalPresPenalty: (val: number) => void;
  startEditing: (idx: number, content: string) => void;
  saveEdit: (idx: number) => void;
  setEditingIdx: (val: number | null) => void;
  startTuning: (e: React.MouseEvent, idx: number, msg: Message) => void;
  executeRegeneration: (idx: number) => void;
}

const ObservedMessageItem: React.FC<ObservedItemProps> = ({
  msg,
  idx,
  isLoading,
  isEditing,
  isTuning,
  editContent,
  setEditContent,
  editTextAreaRef,
  popoverRef,
  localTemp,
  setLocalTemp,
  localTopP,
  setLocalTopP,
  localFreqPenalty,
  setLocalFreqPenalty,
  localPresPenalty,
  setLocalPresPenalty,
  startEditing,
  saveEdit,
  setEditingIdx,
  startTuning,
  executeRegeneration,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        // Cache the last precise rendered height right before it exits screen bounds
        if (entry.isIntersecting) {
          setHeight(entry.target.getBoundingClientRect().height);
        }
      },
      {
        root: null,
        rootMargin: "400px 0px 400px 0px", // Expanded to 400px for smoother virtual padding transition
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Compute width signatures
  const isUser = msg.role === "user";
  let cardWidthStyles = "";
  if (isUser) {
    cardWidthStyles = isEditing
      ? "w-[85%] ml-auto self-end bg-theme-panel border-theme-border text-theme-text"
      : "w-fit max-w-[85%] ml-auto self-end bg-theme-panel border-theme-border text-theme-text";
  } else {
    cardWidthStyles = `w-full mr-auto bg-theme-panel/40 border-theme-border/60 text-theme-text text-justify ${msg.isPruned ? "opacity-40" : ""}`;
  }

  // If the node is hidden, render an empty frame with the explicit cached height
  if (!isVisible && height !== null) {
    return (
      <div
        ref={containerRef}
        style={{ height: `${height}px` }}
        className={`w-full pointer-events-none opacity-0 border p-3 flex flex-col ${
          isUser ? "ml-auto self-end" : "mr-auto"
        }`}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group flex flex-col p-3 rounded-xl border animate-messageSlide transition-all duration-200 relative ${cardWidthStyles}`}
    >
      {/* Upper Meta Info Header Bar */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-1.5 mb-2 select-none">
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase ${isUser ? "text-theme-muted" : "text-theme-accent"}`}
          >
            {isUser ? "User" : "Local Engine"}
          </span>
          {!isUser &&
            (msg.temperature !== undefined || msg.topP !== undefined) && (
              <span className="text-[9px] font-mono bg-theme-panel px-1.5 py-0.5 rounded border border-theme-border/60 text-theme-muted">
                t: {msg.temperature ?? 0.7} | p: {msg.topP ?? 0.9}
              </span>
            )}
        </div>

        {/* Operational Utility Controls Toolbar */}
        {!isLoading && !isEditing && (
          <div className="flex items-center gap-1.5 relative">
            {isUser ? (
              <button
                type="button"
                onClick={() => startEditing(idx, msg.content)}
                className="p-1 hover:bg-theme-panel rounded text-theme-accent transition duration-150 cursor-pointer"
                title="Edit prompt entry"
              >
                <Pencil className="w-3 h-3 stroke-[2.5]" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  data-tuning-toggle="true"
                  onClick={(e) => startTuning(e, idx, msg)}
                  className={`p-1 hover:bg-theme-panel rounded transition duration-150 cursor-pointer relative z-20 ${
                    isTuning
                      ? "text-theme-accent bg-theme-panel"
                      : "text-theme-accent"
                  }`}
                  title="Tune checkpoint parameters"
                >
                  <Settings className="w-3 h-3 stroke-[2.5]" />
                </button>

                {/* FLOATING HOVERING WINDOW */}
                {isTuning && (
                  <div
                    ref={popoverRef}
                    className="absolute right-0 top-6 z-50 w-64 bg-theme-panel border border-theme-border rounded-xl shadow-xl p-3 space-y-3.5 text-theme-text cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-theme-muted uppercase tracking-wider border-b border-theme-border/40 pb-1">
                      <SlidersHorizontal className="w-3 h-3 text-theme-accent" />
                      <span>Parametric Checkpoint Tuning</span>
                    </div>

                    <div className="space-y-2.5">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-theme-text/80">
                            Temperature
                          </span>
                          <span className="text-theme-accent font-semibold">
                            {localTemp.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.5"
                          step="0.05"
                          value={localTemp}
                          onChange={(e) =>
                            setLocalTemp(parseFloat(e.target.value))
                          }
                          className="w-full accent-theme-accent h-1 bg-theme-bg rounded-lg cursor-pointer appearance-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-theme-text/80">
                            Top-P Sampling
                          </span>
                          <span className="text-theme-accent font-semibold">
                            {localTopP.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="1.0"
                          step="0.05"
                          value={localTopP}
                          onChange={(e) =>
                            setLocalTopP(parseFloat(e.target.value))
                          }
                          className="w-full accent-theme-accent h-1 bg-theme-bg rounded-lg cursor-pointer appearance-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-theme-text/80">
                            Frequency Penalty
                          </span>
                          <span className="text-theme-accent font-semibold">
                            {localFreqPenalty.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.1"
                          value={localFreqPenalty}
                          onChange={(e) =>
                            setLocalFreqPenalty(parseFloat(e.target.value))
                          }
                          className="w-full accent-theme-accent h-1 bg-theme-bg rounded-lg cursor-pointer appearance-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-mono">
                          <span className="text-theme-text/80">
                            Presence Penalty
                          </span>
                          <span className="text-theme-accent font-semibold">
                            {localPresPenalty.toFixed(2)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-2.0"
                          max="2.0"
                          step="0.1"
                          value={localPresPenalty}
                          onChange={(e) =>
                            setLocalPresPenalty(parseFloat(e.target.value))
                          }
                          className="w-full accent-theme-accent h-1 bg-theme-bg rounded-lg cursor-pointer appearance-none"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-1 border-t border-theme-border/40">
                      <button
                        type="button"
                        onClick={() => executeRegeneration(idx)}
                        className="w-full text-center py-1.5 bg-theme-accent text-theme-bg font-semibold rounded-lg text-xs hover:bg-theme-accent-hover transition active:scale-[0.98] cursor-pointer"
                      >
                        Re-compile Checkpoint
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* CORE CONTENT WORKSPACE */}
      {isUser ? (
        isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              ref={editTextAreaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full bg-theme-bg border border-theme-border/80 focus:border-theme-accent/60 rounded-lg p-2 text-sm text-theme-text focus:outline-none font-mono resize-none leading-relaxed"
              rows={1}
            />
            <div className="flex items-center justify-end gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setEditingIdx(null)}
                className="flex items-center gap-1 px-2.5 py-1 text-theme-muted hover:text-theme-text hover:bg-theme-panel/60 rounded-md transition cursor-pointer"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={() => saveEdit(idx)}
                disabled={!editContent.trim()}
                className="flex items-center gap-1 px-2.5 py-1 bg-theme-accent text-theme-bg font-semibold rounded-md hover:bg-theme-accent-hover transition disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3 h-3 stroke-[2.5]" /> Resubmit
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-theme-text">
            {msg.content}
          </p>
        )
      ) : (
        <div className="prose prose-invert prose-sm max-w-none text-theme-text leading-relaxed text-justify">
          <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};
