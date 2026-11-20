// src/components/WorkspaceCanvas.tsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { WorkspaceArtifact, ArtifactVersion } from "../utils/db";
import {
  Plus,
  X,
  Copy,
  Check,
  GitCompare,
  Save,
  FileCode2,
  Columns2,
} from "lucide-react";
import { normalizeWorkspaceLanguage, WorkspaceLanguage } from "@renderer/store";

export interface SelectionRange {
  startLine: number;
  endLine: number;
  selectedText: string;
}

export interface LiveCanvasDraft {
  mode: "create" | "patch" | "fence";
  title?: string;
  language?: string;
  content: string;
}

interface WorkspaceCanvasProps {
  sessionId: string;
  artifacts: WorkspaceArtifact[];
  activeArtifactId: string | null;
  isStreaming?: boolean;
  liveDraft?: LiveCanvasDraft | null;
  onSelectArtifact: (id: string) => void;
  onCreateArtifact: (
    title?: string,
    language?: string,
    content?: string,
  ) => void;
  onUpdateArtifact: (updated: WorkspaceArtifact) => void;
  onDeleteArtifact: (id: string) => void;
  onSelectionChange?: (selection: SelectionRange | null) => void;
  onCloseWorkspace: () => void;
  extraToolbarActions?: React.ReactNode;
}

interface DiffLine {
  type: "unchanged" | "added" | "removed";
  text: string;
}

function computeLineDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (
      i < oldLines.length &&
      j < newLines.length &&
      oldLines[i] === newLines[j]
    ) {
      result.push({ type: "unchanged", text: oldLines[i] });
      i++;
      j++;
    } else {
      let foundMatch = false;
      for (let lookahead = 1; lookahead <= 5; lookahead++) {
        if (
          i + lookahead < oldLines.length &&
          oldLines[i + lookahead] === newLines[j]
        ) {
          for (let k = 0; k < lookahead; k++) {
            result.push({ type: "removed", text: oldLines[i + k] });
          }
          i += lookahead;
          foundMatch = true;
          break;
        }
        if (
          j + lookahead < newLines.length &&
          oldLines[i] === newLines[j + lookahead]
        ) {
          for (let k = 0; k < lookahead; k++) {
            result.push({ type: "added", text: newLines[j + k] });
          }
          j += lookahead;
          foundMatch = true;
          break;
        }
      }

      if (!foundMatch) {
        if (i < oldLines.length) {
          result.push({ type: "removed", text: oldLines[i] });
          i++;
        }
        if (j < newLines.length) {
          result.push({ type: "added", text: newLines[j] });
          j++;
        }
      }
    }
  }
  return result;
}

export const WorkspaceCanvas: React.FC<WorkspaceCanvasProps> = ({
  artifacts,
  activeArtifactId,
  isStreaming = false,
  liveDraft,
  onSelectArtifact,
  onCreateArtifact,
  onUpdateArtifact,
  onDeleteArtifact,
  onSelectionChange,
  onCloseWorkspace,
  extraToolbarActions,
}) => {
  const activeArtifact = useMemo(
    () =>
      artifacts.find((a) => a.id === activeArtifactId) || artifacts[0] || null,
    [artifacts, activeArtifactId],
  );

  // Keep the most recent streamed draft so the canvas doesn't flash empty
  // between finishing the code block and committing the artifact at stream end.
  const [retainedDraft, setRetainedDraft] = useState<LiveCanvasDraft | null>(
    null,
  );
  const [draftContent, setDraftContent] = useState<string>("");
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [showDiff, setShowDiff] = useState<boolean>(false);
  const [isEditingTitle, setIsEditingTitle] = useState<boolean>(false);
  const [titleInput, setTitleInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [selection, setSelection] = useState<SelectionRange | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (liveDraft) {
      setRetainedDraft(liveDraft);
      return;
    }
    // Hold retainedDraft until a persisted activeArtifact is ready
    if (activeArtifact) {
      setRetainedDraft(null);
    }
  }, [liveDraft, activeArtifact]);

  const effectiveDraft = liveDraft ?? retainedDraft;

  useEffect(() => {
    if (effectiveDraft) {
      setDraftContent(effectiveDraft.content);
      if (effectiveDraft.mode === "create" && effectiveDraft.title) {
        setTitleInput(effectiveDraft.title);
      }
      setIsDirty(false);
      setShowDiff(false);
      return;
    }

    if (activeArtifact) {
      setDraftContent(activeArtifact.content);
      setTitleInput(activeArtifact.title);
      setIsDirty(false);
      setSelection(null);
      onSelectionChange?.(null);
    } else {
      setDraftContent("");
      setTitleInput("");
      setIsDirty(false);
    }
  }, [
    effectiveDraft,
    activeArtifact?.id,
    activeArtifact?.content,
    activeArtifact?.currentVersion,
  ]);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextVal = e.target.value;
    setDraftContent(nextVal);
    setIsDirty(Boolean(activeArtifact && nextVal !== activeArtifact.content));
  };

  const handleSaveCheckpoint = () => {
    if (!activeArtifact || !isDirty) return;

    const nextVersionNum = activeArtifact.versions.length + 1;
    const newSnapshot: ArtifactVersion = {
      version: nextVersionNum,
      content: draftContent,
      timestamp: Date.now(),
      source: "user",
      summary: "Manual edit",
    };

    const updated: WorkspaceArtifact = {
      ...activeArtifact,
      content: draftContent,
      versions: [...activeArtifact.versions, newSnapshot],
      currentVersion: nextVersionNum,
      updatedAt: Date.now(),
    };

    onUpdateArtifact(updated);
    setIsDirty(false);
  };

  const handleSelectVersion = (versionNum: number) => {
    if (!activeArtifact) return;
    const target = activeArtifact.versions.find(
      (v) => v.version === versionNum,
    );
    if (!target) return;

    const updated: WorkspaceArtifact = {
      ...activeArtifact,
      content: target.content,
      currentVersion: target.version,
      updatedAt: Date.now(),
    };
    onUpdateArtifact(updated);
  };

  const handleTitleCommit = () => {
    setIsEditingTitle(false);
    if (
      !activeArtifact ||
      !titleInput.trim() ||
      titleInput === activeArtifact.title
    ) {
      setTitleInput(activeArtifact?.title || "");
      return;
    }
    onUpdateArtifact({
      ...activeArtifact,
      title: titleInput.trim(),
      updatedAt: Date.now(),
    });
  };

  const handleSelectText = () => {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;

    if (start === end) {
      if (selection !== null) {
        setSelection(null);
        onSelectionChange?.(null);
      }
      return;
    }

    const beforeStart = draftContent.slice(0, start);
    const selectedText = draftContent.slice(start, end);
    const startLine = beforeStart.split("\n").length;
    const endLine = startLine + selectedText.split("\n").length - 1;

    const nextSelection: SelectionRange = { startLine, endLine, selectedText };
    setSelection(nextSelection);
    onSelectionChange?.(nextSelection);
  };

  const handleCopy = async () => {
    if (!draftContent) return;
    await navigator.clipboard.writeText(draftContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const diffLines = useMemo(() => {
    if (!activeArtifact || activeArtifact.versions.length < 2) return [];
    const currentIdx = activeArtifact.versions.findIndex(
      (v) => v.version === activeArtifact.currentVersion,
    );
    const prevVersion =
      currentIdx > 0
        ? activeArtifact.versions[currentIdx - 1]
        : activeArtifact.versions[0];
    return computeLineDiff(prevVersion.content, draftContent);
  }, [activeArtifact, draftContent]);

  const lineCount = useMemo(
    () => draftContent.split("\n").length,
    [draftContent],
  );

  const hasWorkspaceContent = Boolean(activeArtifact || effectiveDraft);

  return (
    <div className="flex flex-col h-full w-full bg-theme-bg text-theme-text border-l border-theme-border select-none">
      {/* Top Tab Bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-theme-panel/60 border-b border-theme-border gap-2">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1">
          {artifacts.map((art) => {
            const isActive = art.id === activeArtifact?.id;
            return (
              <div
                key={art.id}
                onClick={() => onSelectArtifact(art.id)}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-all shrink-0 ${
                  isActive
                    ? "bg-theme-bg text-theme-accent border border-theme-border font-semibold shadow-2xs"
                    : "text-theme-muted hover:text-theme-text hover:bg-theme-panel"
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                <span className="truncate max-w-32.5">{art.title}</span>
                {isActive && isDirty && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400"
                    title="Unsaved local edits"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteArtifact(art.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-theme-muted ml-0.5 cursor-pointer"
                  title="Close file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() =>
              onCreateArtifact(
                `scratchpad-${artifacts.length + 1}.md`,
                "markdown",
                "",
              )
            }
            className="flex items-center gap-1 px-2 py-1 text-xs font-mono text-theme-muted hover:text-theme-text hover:bg-theme-panel rounded-lg transition-colors shrink-0 cursor-pointer"
            title="New blank workspace file"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onCloseWorkspace}
          className="p-1.5 text-theme-muted hover:text-theme-text hover:bg-theme-panel rounded-lg transition-colors cursor-pointer"
          title="Collapse workspace pane"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Empty State */}
      {!hasWorkspaceContent ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-theme-muted">
          <Columns2 className="w-8 h-8 text-theme-accent/60 mb-3" />
          <p className="text-sm font-semibold text-theme-text mb-1">
            Canvas Workspace Ready
          </p>
          <p className="text-xs max-w-xs mb-4 leading-relaxed">
            Create a blank file to draft notes or code independently, or send a
            prompt while Workspace Mode is active.
          </p>
          <button
            type="button"
            onClick={() => onCreateArtifact("untitled.md", "markdown", "")}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium bg-theme-accent text-theme-bg hover:bg-theme-accent-hover rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Blank File</span>
          </button>
        </div>
      ) : (
        <>
          {/* Secondary Action & Metadata Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 bg-theme-panel/30 border-b border-theme-border text-xs gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              {isEditingTitle && activeArtifact ? (
                <input
                  autoFocus
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onBlur={handleTitleCommit}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleCommit()}
                  className="bg-theme-panel text-theme-text px-2 py-0.5 rounded-md border border-theme-accent outline-none text-xs font-mono"
                />
              ) : (
                <span
                  onDoubleClick={() =>
                    activeArtifact && setIsEditingTitle(true)
                  }
                  className="font-mono font-semibold text-theme-text cursor-pointer hover:text-theme-accent transition-colors"
                  title={
                    activeArtifact ? "Double-click to rename" : "Drafting file"
                  }
                >
                  {activeArtifact?.title || effectiveDraft?.title || "untitled"}
                </span>
              )}

              <select
                value={normalizeWorkspaceLanguage(
                  activeArtifact?.language ||
                    effectiveDraft?.language ||
                    "markdown",
                )}
                disabled={!activeArtifact || Boolean(liveDraft)}
                onChange={(e) => {
                  if (!activeArtifact) return;
                  onUpdateArtifact({
                    ...activeArtifact,
                    language: e.target.value as WorkspaceLanguage,
                    updatedAt: Date.now(),
                  });
                }}
                className="bg-theme-panel text-theme-muted hover:text-theme-text text-[11px] font-mono px-2 py-0.5 rounded-md border border-theme-border outline-none cursor-pointer disabled:opacity-60"
              >
                <option value="markdown" className="bg-theme-bg">
                  Markdown (.md)
                </option>
                <option value="python" className="bg-theme-bg">
                  Python (.py)
                </option>
                <option value="typescript" className="bg-theme-bg">
                  TypeScript (.ts)
                </option>
                <option value="tsx" className="bg-theme-bg">
                  TSX (.tsx)
                </option>
                <option value="javascript" className="bg-theme-bg">
                  JavaScript (.js)
                </option>
                <option value="jsx" className="bg-theme-bg">
                  JSX (.jsx)
                </option>
                <option value="html" className="bg-theme-bg">
                  HTML (.html)
                </option>
                <option value="css" className="bg-theme-bg">
                  CSS (.css)
                </option>
                <option value="json" className="bg-theme-bg">
                  JSON (.json)
                </option>
                <option value="sql" className="bg-theme-bg">
                  SQL (.sql)
                </option>
                <option value="bash" className="bg-theme-bg">
                  Bash (.sh)
                </option>
                <option value="rust" className="bg-theme-bg">
                  Rust (.rs)
                </option>
                <option value="go" className="bg-theme-bg">
                  Go (.go)
                </option>
              </select>

              {activeArtifact && activeArtifact.versions.length > 0 && (
                <select
                  value={activeArtifact.currentVersion}
                  onChange={(e) => handleSelectVersion(Number(e.target.value))}
                  className="bg-theme-panel text-theme-accent text-[11px] font-mono px-2 py-0.5 rounded-md border border-theme-border outline-none cursor-pointer"
                  title="Switch version snapshot"
                >
                  {activeArtifact.versions.map((v) => (
                    <option
                      key={v.version}
                      value={v.version}
                      className="bg-theme-bg"
                    >
                      v{v.version} ({v.source})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {extraToolbarActions}

              {activeArtifact && activeArtifact.versions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setShowDiff((prev) => !prev)}
                  className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono border transition-colors cursor-pointer ${
                    showDiff
                      ? "bg-theme-accent/15 border-theme-accent/40 text-theme-accent"
                      : "bg-theme-panel border-theme-border text-theme-muted hover:text-theme-text"
                  }`}
                >
                  <GitCompare className="w-3 h-3" />
                  <span>{showDiff ? "Editor" : "Diff"}</span>
                </button>
              )}

              {activeArtifact && isDirty && (
                <button
                  type="button"
                  onClick={handleSaveCheckpoint}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>Save v{activeArtifact.versions.length + 1}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono bg-theme-panel hover:bg-theme-border/40 border border-theme-border text-theme-muted hover:text-theme-text transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
          </div>

          {/* Selection Focus Banner */}
          {selection && !showDiff && (
            <div className="flex items-center justify-between px-3 py-1 bg-theme-accent/10 border-b border-theme-accent/25 text-[11px] font-mono text-theme-accent">
              <span>
                Target focus: Lines {selection.startLine}–{selection.endLine}{" "}
                selected
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelection(null);
                  onSelectionChange?.(null);
                }}
                className="hover:underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Main Editor or Diff Body */}
          <div className="flex-1 relative overflow-auto font-mono text-xs select-text">
            {showDiff ? (
              <div className="p-3 space-y-0.5">
                {diffLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`px-2 py-0.5 whitespace-pre-wrap rounded-sm ${
                      line.type === "added"
                        ? "bg-emerald-500/15 text-emerald-400 border-l-2 border-emerald-500"
                        : line.type === "removed"
                          ? "bg-red-500/15 text-red-400 border-l-2 border-red-500 line-through opacity-80"
                          : "text-theme-muted"
                    }`}
                  >
                    <span className="inline-block w-4 select-none opacity-60">
                      {line.type === "added"
                        ? "+"
                        : line.type === "removed"
                          ? "-"
                          : " "}
                    </span>
                    {line.text || " "}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-full">
                <div
                  aria-hidden="true"
                  className="py-3 px-2.5 text-right text-theme-muted/50 bg-theme-panel/20 border-r border-theme-border/60 select-none shrink-0"
                >
                  {Array.from({ length: lineCount }).map((_, idx) => (
                    <div key={idx} className="leading-5">
                      {idx + 1}
                    </div>
                  ))}
                </div>

                <textarea
                  ref={textareaRef}
                  value={draftContent}
                  onChange={handleContentChange}
                  onSelect={handleSelectText}
                  onKeyUp={handleSelectText}
                  disabled={isStreaming || Boolean(liveDraft)}
                  spellCheck={false}
                  placeholder="Write or paste content here, or ask Gemma in Workspace Mode..."
                  className="flex-1 p-3 bg-transparent text-theme-text placeholder-theme-muted/50 outline-none resize-none leading-5 whitespace-pre overflow-x-auto"
                />
              </div>
            )}
          </div>

          {/* Footer Status Bar */}
          <div className="flex items-center justify-between px-3 py-1 bg-theme-panel/40 border-t border-theme-border text-[11px] font-mono text-theme-muted">
            <span>
              {lineCount} lines · {draftContent.length} chars
            </span>
            <span>
              {liveDraft
                ? liveDraft.mode === "create"
                  ? `Streaming ${liveDraft.title || "new artifact"}...`
                  : "Streaming live edits..."
                : retainedDraft && isStreaming
                  ? "Finalizing workspace file..."
                  : isStreaming
                    ? "Model updating workspace..."
                    : isDirty
                      ? "Unsaved local edits"
                      : activeArtifact
                        ? `Synced (v${activeArtifact.currentVersion})`
                        : "Draft ready"}
            </span>
          </div>
        </>
      )}
    </div>
  );
};
