// src/components/ContextSidebar.tsx
import React, { useMemo } from "react";
import { useChatStore } from "../store";
import { Pin, Scissors, Activity, Layers, HelpCircle } from "lucide-react";

export const ContextSidebar: React.FC = () => {
  const {
    messages,
    model,
    toggleMessagePin,
    toggleMessagePrune,
    getContextWindowLimit,
  } = useChatStore();

  // Pull the dynamic context window limit directly from our custom store state selector
  const contextWindowLimit = getContextWindowLimit
    ? getContextWindowLimit()
    : 4096;

  // Fast client-side character estimation utility (4 chars ~ 1 Token)
  const contextStats = useMemo(() => {
    let totalTokens = 0;
    let activeTokens = 0;

    // Track unique fingerprints matching store constraint layer checks
    const uniquePinSignatures = new Set<string>();
    let prunedCount = 0;

    messages.forEach((msg) => {
      const estimatedTokens = Math.ceil((msg.content || "").length / 4);
      totalTokens += estimatedTokens;

      if (msg.isPinned && !msg.isPruned) {
        const fingerprint = msg.content
          .slice(0, 50)
          .toLowerCase()
          .replace(/\s+/g, "")
          .trim();
        uniquePinSignatures.add(fingerprint);
      }

      if (msg.isPruned) {
        prunedCount++;
      } else {
        activeTokens += estimatedTokens;
      }
    });

    const pinnedCount = uniquePinSignatures.size;
    const loadPercentage = Math.min(
      Math.round((activeTokens / contextWindowLimit) * 100),
      100,
    );

    return {
      totalTokens,
      activeTokens,
      pinnedCount,
      prunedCount,
      loadPercentage,
    };
  }, [messages, contextWindowLimit]);

  // Sliding Window Diagnostics: Compute which items are inside the active rolling history payload
  const activeConversationalBuffer = useMemo(() => {
    const EXPLICIT_HISTORY_TURN_LIMIT = 8;
    // Filter down to match core telemetry pipeline conditions
    const fluidConversationalHistory = messages.filter(
      (m) => !m.isPinned && !m.isPruned,
    );
    // Slice the most recent 8 messages
    return fluidConversationalHistory.slice(-EXPLICIT_HISTORY_TURN_LIMIT);
  }, [messages]);

  // Clean layout state tracking for empty chat sessions
  if (messages.length === 0) {
    return (
      <aside className="w-72 bg-theme-panel/20 border-l border-theme-border/70 p-5 lg:flex-col items-center justify-center text-center shrink-0 hidden lg:flex select-none">
        <HelpCircle className="w-8 h-8 text-theme-muted/40 mb-3 animate-pulse" />
        <h5 className="text-theme-text/80 font-semibold text-xs tracking-wide">
          Telemetry Idle
        </h5>
        <p className="text-[11px] text-theme-muted max-w-45 mt-1 leading-relaxed">
          Initiate an active session stream to monitor parametric context
          parsing rules live.
        </p>
      </aside>
    );
  }

  const isPinLimitReached = contextStats.pinnedCount >= 5;

  return (
    <aside className="w-72 bg-theme-panel/20 border-l border-theme-border/70 h-full overflow-hidden shrink-0 select-none transition-colors duration-200 hidden lg:flex lg:flex-col">
      {/* ================= TELEMETRY DASHBOARD DOCK ================= */}
      <div className="p-4 border-b border-theme-border/60 bg-theme-bg/40 space-y-3 shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-theme-accent" />
          <h4 className="text-theme-text font-bold text-xs uppercase tracking-wider">
            Context Telemetry
          </h4>
        </div>

        {/* Live Token Bar Metric */}
        <div className="space-y-1">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-theme-muted">Memory Allocation</span>
            <span
              className={
                contextStats.loadPercentage > 85
                  ? "text-amber-500 font-bold"
                  : "text-theme-accent"
              }
            >
              {contextStats.activeTokens} / {contextWindowLimit} Tkn (
              {contextStats.loadPercentage}%)
            </span>
          </div>
          <div className="w-full h-1.5 bg-black/20 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <div
              className="h-full bg-theme-accent transition-all duration-500 ease-out rounded-full shadow-[0_0_8px_var(--color-theme-glow)]"
              style={{ width: `${contextStats.loadPercentage}%` }}
            />
          </div>
        </div>

        {/* Badge Metadata Readout Summary */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-black/15 border border-theme-border/40 rounded-lg p-1.5 flex items-center justify-between text-[11px] font-mono">
            <span className="text-theme-muted flex items-center gap-1">
              <Layers className="w-3 h-3" /> Core Pins
            </span>
            <span
              className={`font-semibold ${isPinLimitReached ? "text-amber-500" : "text-theme-text"}`}
            >
              {contextStats.pinnedCount}/5
            </span>
          </div>
          <div className="bg-black/15 border border-theme-border/40 rounded-lg p-1.5 flex items-center justify-between text-[11px] font-mono">
            <span className="text-theme-muted flex items-center gap-1">
              <Scissors className="w-3 h-3" /> Pruned
            </span>
            <span className="text-theme-text font-semibold">
              {contextStats.prunedCount}
            </span>
          </div>
        </div>
      </div>

      {/* ================= ACTIVE NODE REGISTER FEED ================= */}
      <div className="flex-1 overflow-y-auto p-4 pr-4 space-y-2 max-h-full">
        <div className="text-[10px] font-bold text-theme-muted/80 uppercase tracking-widest pl-1 mb-2">
          Conversational Payload Map
        </div>

        {messages.map((msg, index) => {
          const estimatedTokens = Math.ceil((msg.content || "").length / 4);
          const isUser = msg.role === "user";

          // Evaluate if an unpinned/unpruned message has been pushed out of the 8-turn budget
          const isAgedOut =
            !msg.isPinned &&
            !msg.isPruned &&
            !activeConversationalBuffer.includes(msg);

          // Determine structural pinning blocks based on context states
          const canPinThisNode = msg.isPinned || !isPinLimitReached;

          return (
            <div
              key={index}
              className={`p-2.5 border rounded-xl flex flex-col gap-2 transition-all duration-200 ${
                msg.isPruned
                  ? "bg-theme-panel/10 border-theme-border/30 opacity-40 line-through text-theme-muted/60"
                  : isAgedOut
                    ? "bg-black/5 border-theme-border/20 opacity-30 text-theme-muted/50 saturate-50"
                    : msg.isPinned
                      ? "bg-theme-panel border-theme-accent text-theme-text shadow-sm shadow-theme-accent/5"
                      : "bg-theme-panel/40 border-theme-border/50 text-theme-text/90 hover:border-theme-border"
              }`}
            >
              {/* Node Card Metadata Header */}
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span
                  className={`font-bold ${
                    msg.isPruned || isAgedOut
                      ? "text-theme-muted"
                      : isUser
                        ? "text-theme-accent/80"
                        : "text-theme-muted"
                  }`}
                >
                  {isAgedOut
                    ? "AGED_OUT_BUFFER"
                    : isUser
                      ? "USER_PROMPT"
                      : "COMPUTED_REPLY"}
                </span>
                <span className="text-theme-muted/70 bg-black/10 px-1.5 py-0.5 rounded-sm">
                  ~{estimatedTokens} Tkn
                </span>
              </div>

              {/* Text Snippet Area */}
              <p className="text-xs font-mono line-clamp-2 leading-relaxed tracking-tight select-text overflow-hidden break-all">
                {msg.content || (
                  <em className="opacity-40 italic">
                    Streaming chunk pipeline open...
                  </em>
                )}
              </p>

              {/* Node Action Gutter Controllers */}
              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-theme-border/20 mt-1 shrink-0">
                {/* 📌 Pin Action Button */}
                <button
                  type="button"
                  disabled={!canPinThisNode}
                  onClick={() => toggleMessagePin(index)}
                  title={
                    msg.isPinned
                      ? "Unanchor from Core Context"
                      : !canPinThisNode
                        ? "Context Budget Full (Max 5 Unique Pins)"
                        : isAgedOut
                          ? "Rescue context back to Core Anchors"
                          : "Anchor to Permanent Context"
                  }
                  className={`p-1.5 rounded-md border transition-all flex items-center justify-center active:scale-95 ${
                    msg.isPinned
                      ? "bg-theme-accent border-theme-accent text-theme-bg cursor-pointer"
                      : !canPinThisNode
                        ? "bg-black/5 border-theme-border/20 text-theme-muted/30 cursor-not-allowed pointer-events-none"
                        : "bg-black/10 border-theme-border/40 text-theme-muted hover:text-theme-text hover:border-theme-border cursor-pointer"
                  }`}
                >
                  <Pin className="w-3 h-3 stroke-[2.5]" />
                </button>

                {/* ✂️ Prune Action Button */}
                <button
                  type="button"
                  onClick={() => toggleMessagePrune(index)}
                  title={
                    msg.isPruned
                      ? "Restore Context Visibility"
                      : "Surgically Prune from Context Memory"
                  }
                  className={`p-1.5 rounded-md border transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    msg.isPruned
                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                      : "bg-black/10 border-theme-border/40 text-theme-muted hover:text-red-400 hover:border-red-500/30"
                  }`}
                >
                  <Scissors className="w-3 h-3 stroke-[2.5]" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Indicator Footer Tracker */}
      <div className="p-3 bg-theme-panel/30 border-t border-theme-border/60 text-center font-mono text-[10px] text-theme-muted tracking-wide shrink-0 truncate">
        Node: {model || "No Target Connected"}
      </div>
    </aside>
  );
};
