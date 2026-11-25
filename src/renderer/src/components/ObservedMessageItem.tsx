import { Check, ChevronDown, FileCode2, Pencil, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { renderTextWithCitations } from "./CitationPills";
import { LoadingDots } from "./LoadingDots";
import { ResponseTuningPopover } from "./ResponseTuningPopover";
import { ObservedItemProps } from "@renderer/types";

export const ObservedMessageItem: React.FC<ObservedItemProps> = ({
  msg,
  idx,
  isLoading,
  isSplitPane = false,
  activeArtifactAction = null,
  onUpdateUserMessage,
  onOpenArtifact,
  onRegenerateFromCheckpoint,
  onSelectCitation,
  sessionArtifactSummary,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [height, setHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sandboxed local UI states for this message instance explicitly
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState("");

  const [isTuning, setIsTuning] = useState(false);
  // Tracks if the dropdown opens above or below the cog
  const [popoverDirection, setPopoverDirection] = useState<"above" | "below">(
    "below",
  );

  const [localTemp, setLocalTemp] = useState(0.7);
  const [localTopP, setLocalTopP] = useState(0.9);
  const [localFreqPenalty, setLocalFreqPenalty] = useState(0.0);
  const [localPresPenalty, setLocalPresPenalty] = useState(0.0);

  const editTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isUser = msg.role === "user";

  const artifactBadgeLabel = !isUser
    ? msg.artifactSummary || sessionArtifactSummary
    : null;

  // Keep visible during split-pane transitions so layout shifts never leave a blank card
  useEffect(() => {
    setIsVisible(true);
  }, [isSplitPane]);

  useEffect(() => {
    setLocalTemp(msg.temperature ?? 0.7);
    setLocalTopP(msg.topP ?? 0.9);
    setLocalFreqPenalty(msg.frequencyPenalty ?? 0.0);
    setLocalPresPenalty(msg.presencePenalty ?? 0.0);
    setEditContent(msg.content);
  }, [msg]);

  // Intersection Observer for performance virtualization
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        // Cache initial or visible height markers accurately
        if (entry.isIntersecting) {
          setHeight(entry.target.getBoundingClientRect().height);
        }
      },
      {
        root: null,
        rootMargin: "800px 0px 800px 0px",
      },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Recalculate and update precise dimensions if markdown streams or editor mounts updates
  useEffect(() => {
    if (containerRef.current && isVisible) {
      setHeight(containerRef.current.getBoundingClientRect().height);
    }
  }, [msg.content, isEditing, isVisible]);

  // Dynamic textarea height calculation
  useEffect(() => {
    if (isEditing && editTextAreaRef.current) {
      editTextAreaRef.current.style.height = "auto";
      editTextAreaRef.current.style.height = `${editTextAreaRef.current.scrollHeight}px`;
    }
  }, [editContent, isEditing]);

  // Click outside popover logic
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedToggleButton =
        target instanceof Element &&
        target.closest(`[data-tuning-toggle='${idx}']`);

      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        !clickedToggleButton
      ) {
        setIsTuning(false);
      }
    };

    if (isTuning) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isTuning, idx]);

  // UI Action Handlers
  const handleStartEditing = () => {
    setEditContent(msg.content);
    setIsEditing(true);
    setIsTuning(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim() && onUpdateUserMessage) {
      onUpdateUserMessage(idx, editContent);
    }
    setIsEditing(false);
  };

  // Typed explicitly to HTMLButtonElement to accurately capture coordinates
  const handleToggleTuning = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!isTuning) {
      // Check vertical coordinate space relative to viewport midpoint
      const rect = e.currentTarget.getBoundingClientRect();
      const isBelowCenter = rect.top > window.innerHeight / 2;
      setPopoverDirection(isBelowCenter ? "above" : "below");

      setLocalTemp(msg.temperature ?? 0.7);
      setLocalTopP(msg.topP ?? 0.9);
      setLocalFreqPenalty(msg.frequencyPenalty ?? 0.0);
      setLocalPresPenalty(msg.presencePenalty ?? 0.0);
      setIsEditing(false);
    }
    setIsTuning(!isTuning);
  };

  const handleExecuteRegeneration = () => {
    if (onRegenerateFromCheckpoint) {
      onRegenerateFromCheckpoint(idx, {
        temperature: localTemp,
        topP: localTopP,
        frequencyPenalty: localFreqPenalty,
        presencePenalty: localPresPenalty,
      });
    }
    setIsTuning(false);
  };

  /* ================= RUNTIME RENDERING TREE ================= */
  if (!isVisible && height !== null) {
    return (
      <div
        ref={containerRef}
        style={{ height: `${height}px` }}
        // Matched structural parameters identically to prevent dimensional layout snapping
        className={`w-full pointer-events-none opacity-0 border border-transparent p-4 flex flex-col ${
          isUser ? "w-[60%] ml-auto" : "mr-auto"
        }`}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`group flex flex-col p-4 rounded-xl border transition-all duration-200 relative min-w-0 overflow-hidden ${
        isUser
          ? `${isSplitPane ? "w-[85%]" : "w-[60%]"} ml-auto bg-theme-panel border-theme-border text-theme-text`
          : `w-full mr-auto bg-theme-panel/40 border-theme-border/60 text-theme-text ${msg.isPruned ? "opacity-40" : ""}`
      }`}
    >
      {/* Upper Meta Info Header Bar */}
      <div className="flex items-center justify-between border-b border-theme-border/30 pb-2 mb-2 select-none gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase ${isUser ? "text-theme-muted" : "text-theme-accent"}`}
          >
            {isUser ? "User" : "Local Engine"}
          </span>

          {artifactBadgeLabel && (
            <button
              type="button"
              onClick={() => onOpenArtifact?.(artifactBadgeLabel)}
              title="Open file in Workspace Canvas"
              className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent px-2 py-0.5 rounded-md border border-theme-accent/30 transition-colors cursor-pointer"
            >
              <FileCode2 className="w-2.5 h-2.5" />
              <span>{artifactBadgeLabel}</span>
            </button>
          )}

          {!isUser && activeArtifactAction && (
            <div className="mb-2 inline-flex items-center gap-2 text-xs font-mono text-theme-accent bg-theme-accent/10 border border-theme-accent/25 px-2.5 py-1 rounded-lg">
              <LoadingDots />
              <span>{activeArtifactAction}</span>
            </div>
          )}

          {!isUser && (
            <div className="flex flex-wrap items-center gap-1.5 select-none animate-fadeIn">
              {/* CREATIVITY TAG */}
              <span className="text-[9px] font-medium bg-theme-panel/80 px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted transition-colors">
                Creativity:{" "}
                <span className="text-theme-accent font-semibold">
                  {msg.temperature === 0
                    ? "Factual"
                    : (msg.temperature ?? 0.7) > 1.0
                      ? "Wild"
                      : "Balanced"}
                </span>
              </span>

              {/* WORD POOL TAG */}
              <span className="text-[9px] font-medium bg-theme-panel/80 px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted transition-colors">
                Word Pool:{" "}
                <span className="text-theme-accent font-semibold">
                  {(msg.topP ?? 0.9) >= 0.9
                    ? "Wide"
                    : (msg.topP ?? 0.9) > 0.4
                      ? "Normal"
                      : "Strict"}
                </span>
              </span>

              {/* REPETITION FILTER TAG */}
              {msg.frequencyPenalty !== undefined &&
                msg.frequencyPenalty !== 0 && (
                  <span className="text-[9px] font-medium bg-theme-panel/80 px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted transition-colors">
                    Filter:{" "}
                    <span className="text-theme-accent font-semibold">
                      {msg.frequencyPenalty > 0 ? "Strict" : "Allowed"}
                    </span>
                  </span>
                )}

              {/* TOPIC VARIATION TAG */}
              {msg.presencePenalty !== undefined &&
                msg.presencePenalty !== 0 && (
                  <span className="text-[9px] font-medium bg-theme-panel/80 px-2 py-0.5 rounded-md border border-theme-border/40 text-theme-muted transition-colors">
                    Variation:{" "}
                    <span className="text-theme-accent font-semibold">
                      {msg.presencePenalty > 0 ? "Diverse" : "Focused"}
                    </span>
                  </span>
                )}
            </div>
          )}
        </div>

        {/* Controls Toolbar */}
        {!isLoading && !isEditing && (
          <div className="flex items-center gap-1.5 relative shrink-0">
            {isUser ? (
              <button
                type="button"
                onClick={handleStartEditing}
                className="p-1 hover:bg-theme-panel rounded text-theme-accent transition duration-150 cursor-pointer"
                title="Edit prompt entry"
              >
                <Pencil className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            ) : (
              <ResponseTuningPopover
                idx={idx}
                isTuning={isTuning}
                popoverDirection={popoverDirection}
                popoverRef={popoverRef}
                values={{
                  temperature: localTemp,
                  topP: localTopP,
                  frequencyPenalty: localFreqPenalty,
                  presencePenalty: localPresPenalty,
                }}
                onChange={(next) => {
                  setLocalTemp(next.temperature);
                  setLocalTopP(next.topP);
                  setLocalFreqPenalty(next.frequencyPenalty);
                  setLocalPresPenalty(next.presencePenalty);
                }}
                onToggle={handleToggleTuning}
                onRegenerate={handleExecuteRegeneration}
              />
            )}
          </div>
        )}
      </div>

      {/* CORE CONTENT WORKSPACE */}
      {isUser ? (
        isEditing ? (
          <div className="space-y-2 mt-1 w-full">
            <textarea
              ref={editTextAreaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveEdit();
                }
                if (e.key === "Escape") {
                  setIsEditing(false);
                }
              }}
              className="w-full bg-theme-bg border border-theme-border/80 focus:border-theme-accent/60 rounded-lg p-2 text-sm text-theme-text focus:outline-none font-mono resize-none leading-relaxed"
              rows={1}
              placeholder="Edit your prompt checkpoint..."
            />
            <div className="flex items-center justify-end gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex items-center gap-1 px-2.5 py-1 text-theme-muted hover:text-theme-text hover:bg-theme-panel/60 rounded-md transition cursor-pointer"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="flex items-center gap-1 px-2.5 py-1 bg-theme-accent text-theme-bg font-semibold rounded-md hover:bg-theme-accent-hover transition disabled:opacity-40 cursor-pointer"
              >
                <Check className="w-3 h-3 stroke-[2.5]" /> Resubmit
              </button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-theme-text break-all">
            {msg.content}
          </p>
        )
      ) : (
        <div className="prose prose-invert prose-sm max-w-none text-theme-text leading-relaxed text-left w-full overflow-hidden break-all">
          {msg.thinking && (
            <details
              open={!msg.content || msg.content.trim().length === 0}
              className="mb-4 border border-theme-border/30 rounded-lg bg-theme-panel/20 group/thinking"
            >
              <summary className="list-none flex items-center gap-2 px-3 py-1.5 cursor-pointer text-theme-muted hover:text-theme-accent transition-colors rounded-lg">
                <span className="text-[9px] font-medium uppercase tracking-widest opacity-80 grow">
                  Internal Reasoning
                </span>
                {isLoading &&
                  (!msg.content || msg.content.trim().length === 0) && (
                    <LoadingDots className="mr-2" />
                  )}
                <ChevronDown className="w-3 h-3 transition-transform group-open/thinking:rotate-180" />
              </summary>
              <div className="p-3 border-t border-theme-border/20 text-xs text-theme-muted italic font-mono bg-theme-bg/50 break-all">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="wrap-break-word [word-break:normal]">
                        {children}
                      </p>
                    ),
                    li: ({ children }) => (
                      <li className="wrap-break-word [word-break:normal]">
                        {children}
                      </li>
                    ),
                  }}
                >
                  {msg.thinking}
                </ReactMarkdown>
              </div>
            </details>
          )}

          <ReactMarkdown
            components={{
              p: ({ children }) => (
                <p className="wrap-break-word [word-break:normal] m-0">
                  {renderTextWithCitations(children, onSelectCitation)}
                </p>
              ),
              li: ({ children }) => (
                <li className="wrap-break-word [word-break:normal]">
                  {renderTextWithCitations(children, onSelectCitation)}
                </li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-theme-accent/40 pl-3 my-2 italic text-theme-muted">
                  {renderTextWithCitations(children, onSelectCitation)}
                </blockquote>
              ),
              strong: ({ children }) => (
                <strong className="font-semibold text-theme-text">
                  {renderTextWithCitations(children, onSelectCitation)}
                </strong>
              ),
              em: ({ children }) => (
                <em className="italic">
                  {renderTextWithCitations(children, onSelectCitation)}
                </em>
              ),
              td: ({ children }) => (
                <td className="px-2 py-1 border border-theme-border/40">
                  {renderTextWithCitations(children, onSelectCitation)}
                </td>
              ),
              ol: ({ children }) => (
                <ol className="wrap-break-word [word-break:normal] list-decimal pl-4">
                  {children}
                </ol>
              ),
              ul: ({ children }) => (
                <ul className="wrap-break-word [word-break:normal] list-disc pl-4">
                  {children}
                </ul>
              ),
              pre: ({ children }) => (
                <pre className="whitespace-pre-wrap wrap-break-word [word-break:normal] w-full overflow-hidden bg-theme-bg/60 p-3 rounded-lg border border-theme-border/40 my-2">
                  {children}
                </pre>
              ),
              code: ({ children }) => (
                <code className="wrap-break-word whitespace-pre-wrap [word-break:normal] bg-theme-bg/80 px-1 py-0.5 rounded font-mono text-xs text-theme-accent">
                  {children}
                </code>
              ),
            }}
          >
            {msg.content || ""}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};
