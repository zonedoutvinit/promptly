// src/components/ChatWindow.tsx
import {
  sanitizeChatStreamText,
  unwrapProseMarkdownFence,
} from "@renderer/utils/streamSanitizers";
import React, { useEffect } from "react";
import { useChatStore } from "../store";
import { LoadingDots } from "./LoadingDots";
import { ObservedMessageItem } from "./ObservedMessageItem";
import { WorkspaceCanvas } from "./WorkspaceCanvas";
import { ChatWindowProps, SelectionRange } from "@renderer/types";

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  onUpdateUserMessage,
  onRegenerateFromCheckpoint,
  forceWorkspaceOpen = false,
  inspectedArtifactId = null,
}) => {
  const {
    currentSessionId,
    workspaceEnabled = false,
    setWorkspaceEnabled,
    artifacts = [],
    activeArtifactId = null,
    setActiveArtifact,
    createWorkspaceArtifact,
    updateWorkspaceArtifact,
    deleteWorkspaceArtifact,
    setActiveWorkspaceSelection,
    openRagCitationInCanvas,
    highlightedCitation = null,
    clearHighlightedCitation,
  } = useChatStore();

  useEffect(() => {
    if (forceWorkspaceOpen && !workspaceEnabled) {
      setWorkspaceEnabled?.(true);
    }
  }, [forceWorkspaceOpen, workspaceEnabled, setWorkspaceEnabled]);

  useEffect(() => {
    if (
      inspectedArtifactId &&
      artifacts.some((a) => a.id === inspectedArtifactId)
    ) {
      setActiveArtifact?.(inspectedArtifactId);
    }
  }, [inspectedArtifactId, artifacts, setActiveArtifact]);

  const latestAssistantSanitized =
    isLoading &&
    messages.length > 0 &&
    messages[messages.length - 1]?.role === "assistant"
      ? sanitizeChatStreamText(
          messages[messages.length - 1].content,
          workspaceEnabled || forceWorkspaceOpen,
        )
      : null;

  const liveCanvasDraft = latestAssistantSanitized?.liveDraft ?? null;

  const showSplitPane = Boolean(workspaceEnabled || forceWorkspaceOpen);

  const currentCanvasArtifact =
    artifacts.find((a) => a.id === activeArtifactId) ??
    artifacts[artifacts.length - 1] ??
    null;

  const sessionArtifactSummary = currentCanvasArtifact?.title ?? null;

  const handleOpenArtifactFromBadge = (summary: string) => {
    setWorkspaceEnabled?.(true);

    // Extract filename from summaries like "log_filter.py (v3)"
    const titleMatch = /^(.+?)(?:\s+\(v\d+\))?$/.exec(summary.trim());
    const targetTitle = titleMatch?.[1]?.trim();

    if (targetTitle && artifacts.length > 0) {
      const matched = artifacts.find(
        (a) => a.title.toLowerCase() === targetTitle.toLowerCase(),
      );
      if (matched) {
        setActiveArtifact?.(matched.id);
      }
    }
  };

  const hasMessages = messages.length > 0;
  const showChatStreamPane = !showSplitPane || hasMessages || isLoading;

  return (
    <div
      className={`flex-1 flex min-h-0 w-full overflow-hidden bg-theme-bg transition-colors duration-200 ${
        showSplitPane && showChatStreamPane ? "flex-row" : "flex-col"
      }`}
    >
      {/* CHAT STREAM PANE (hidden when inspecting Canvas with zero messages so Canvas gets full width) */}
      {showChatStreamPane && (
        <main
          className={`flex-1 overflow-y-auto p-6 min-w-0 transition-all duration-200 ${
            showSplitPane
              ? "w-full md:w-[45%] lg:w-[42%] border-r border-theme-border"
              : "w-full"
          }`}
        >
          <div className="max-w-3xl w-full mx-auto space-y-6 flex flex-col">
            {/* VIRTUALIZED CONVERSATION PIPELINE */}
            {messages.map((msg, idx) => {
              const isLastAssistant =
                msg.role === "assistant" && idx === messages.length - 1;

              const sanitized =
                msg.role === "assistant"
                  ? sanitizeChatStreamText(msg.content, showSplitPane)
                  : {
                      text: msg.content,
                      activeArtifactAction: null,
                      liveDraft: null,
                    };

              let displayContent =
                msg.role === "assistant"
                  ? unwrapProseMarkdownFence(sanitized.text)
                  : sanitized.text;

              // Only strip completed explicit code fences during streaming in Workspace Mode,
              // keeping markdown/plain prose fences visible in the chat bubble.
              if (isLastAssistant && isLoading && showSplitPane) {
                displayContent = displayContent
                  .replace(
                    /```(?!markdown\b|md\b|text\b|txt\b|plain\b)([a-zA-Z0-9_-]*)\n[\s\S]*?```/g,
                    "",
                  )
                  .trim();
              }

              const activeArtifactAction =
                isLastAssistant && isLoading
                  ? sanitized.activeArtifactAction
                  : null;

              // Never render a bubble with no prose, no thinking, and no active stream status
              if (
                msg.role === "assistant" &&
                !displayContent.trim() &&
                !msg.thinking?.trim() &&
                !activeArtifactAction
              ) {
                return null;
              }

              return (
                <ObservedMessageItem
                  key={idx}
                  msg={{ ...msg, content: displayContent }}
                  idx={idx}
                  isLoading={isLoading}
                  isSplitPane={showSplitPane}
                  activeArtifactAction={activeArtifactAction}
                  onUpdateUserMessage={onUpdateUserMessage}
                  onRegenerateFromCheckpoint={onRegenerateFromCheckpoint}
                  onOpenArtifact={handleOpenArtifactFromBadge}
                  sessionArtifactSummary={sessionArtifactSummary}
                  onSelectCitation={(citationNum) =>
                    void openRagCitationInCanvas(citationNum, idx)
                  }
                />
              );
            })}

            {/* Subtle Loading Placeholder */}
            {isLoading &&
              (() => {
                const lastMsg = messages[messages.length - 1];
                return (
                  lastMsg?.role === "assistant" &&
                  !(lastMsg.content ?? "").trim() &&
                  !(lastMsg.thinking ?? "").trim()
                );
              })() && (
                <div className="w-full mr-auto rounded-xl px-4 py-3 flex items-center animate-in fade-in">
                  <LoadingDots />
                </div>
              )}

            <div ref={messagesEndRef} />
          </div>
        </main>
      )}

      {/* WORKSPACE CANVAS PANE (full width when no messages, right pane once messages exist) */}
      {showSplitPane && (
        <aside
          className={`h-full min-w-0 flex flex-col transition-all duration-200 ${
            showChatStreamPane
              ? "w-full md:w-[55%] lg:w-[58%]"
              : "w-full flex-1"
          }`}
        >
          <WorkspaceCanvas
            sessionId={currentSessionId || "draft"}
            artifacts={artifacts}
            activeArtifactId={activeArtifactId}
            isStreaming={isLoading}
            liveDraft={liveCanvasDraft}
            highlightedCitation={highlightedCitation}
            onClearHighlightedCitation={() => clearHighlightedCitation?.()}
            onSelectArtifact={(id) => {
              clearHighlightedCitation?.();
              setActiveArtifact?.(id);
            }}
            onCreateArtifact={(title, language, content) => {
              createWorkspaceArtifact?.(title, language, content, "user");
            }}
            onUpdateArtifact={(updated) => {
              updateWorkspaceArtifact?.(updated);
            }}
            onDeleteArtifact={(id) => {
              deleteWorkspaceArtifact?.(id);
            }}
            onSelectionChange={(sel: SelectionRange | null) => {
              setActiveWorkspaceSelection?.(sel);
            }}
            onCloseWorkspace={() => {
              clearHighlightedCitation?.();
              setWorkspaceEnabled?.(false);
            }}
          />
        </aside>
      )}
    </div>
  );
};
