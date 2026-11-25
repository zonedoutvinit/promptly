// src/renderer/src/types/index.ts
import React from "react";

// ============================================================================
// CHAT & CONVERSATION
// ============================================================================

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  thinking?: string;
  isPinned?: boolean;
  isPruned?: boolean;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  artifactSummary?: string;
  citations?: RagCitation[];
}

export interface ChatDisplayMessage {
  id?: string;
  role: string;
  content: string;
  thinking?: string;
  isPinned?: boolean;
  isPruned?: boolean;
  temperature?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  artifactSummary?: string;
  citations?: RagCitation[];
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export interface TuningOverrides {
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

export interface StreamingConfig {
  sessionId: string;
  historyForTelemetry: ChatMessage[];
  controller: AbortController;
  get: () => any;
  set: (fn: (state: any) => any) => void;
  overrides?: Record<string, any>;
  webContext?: string;
}

// ============================================================================
// WORKSPACE & CANVAS
// ============================================================================

export type WorkspaceLanguage =
  | "markdown"
  | "python"
  | "typescript"
  | "tsx"
  | "javascript"
  | "jsx"
  | "html"
  | "css"
  | "json"
  | "sql"
  | "bash"
  | "rust"
  | "go";

export type ArtifactTabType = "editor" | "rag_source" | "terminal_output";

export interface ArtifactVersion {
  version: number;
  content: string;
  timestamp: number;
  source: "user" | "assistant" | "preprocess"; // Ready for Phase 2
  summary?: string;
}

export interface WorkspaceArtifact {
  id: string;
  sessionId: string;
  title: string;
  language: string;
  type: ArtifactTabType;
  content: string;
  versions: ArtifactVersion[];
  currentVersion: number;
  updatedAt: number;
}

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

export interface StreamSanitizeResult {
  text: string;
  activeArtifactAction: string | null;
  liveDraft: LiveCanvasDraft | null;
}

export interface DiffLine {
  type: "unchanged" | "added" | "removed";
  text: string;
}

export interface WorkspacePayloadContext {
  enabled: boolean;
  systemDirective?: string;
  activeFile?: {
    title: string;
    language: string;
    content: string;
  } | null;
  selection?: {
    startLine: number;
    endLine: number;
    selectedText: string;
  } | null;
}

// ============================================================================
// RAG & CITATIONS
// ============================================================================

export type RagScope = "session" | "library";
export type RagSourceKind = "html" | "image" | "audio" | "canvas" | "file";

export interface RagCitation {
  citationIndex: number;
  docId: string;
  artifactId?: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
}

export interface HighlightedCitation {
  artifactId: string;
  citationIndex: number;
  title: string;
  text: string;
  chunkIndex: number;
  score: number;
  nonce: number;
}

export interface RagDocument {
  id: string;
  sessionId: string | null;
  scope: RagScope;
  title: string;
  sourceKind: RagSourceKind;
  artifactId?: string;
  chunkCount: number;
  updatedAt: number;
}

export interface RagChunk {
  id: string;
  docId: string;
  sessionId: string | null;
  scope: RagScope;
  title: string;
  chunkIndex: number;
  text: string;
  embedding?: Float32Array | number[];
}

export type SearchStatus = "idle" | "searching" | "completed" | "error";

export interface ChunkTextOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  minPackLength?: number;
}

export interface BuildRagChunksInput {
  docId: string;
  sessionId: string | null;
  scope: RagScope;
  title: string;
  content: string;
  options?: ChunkTextOptions;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface RetrievedChunk {
  chunk: RagChunk;
  citationIndex: number;
  score: number;
}

export interface IndexDocumentInput {
  id: string;
  sessionId: string | null;
  scope: RagScope;
  title: string;
  sourceKind: RagSourceKind;
  content: string;
  artifactId?: string;
  chunkOptions?: ChunkTextOptions;
  embeddingProvider?: EmbeddingProvider;
}

// ============================================================================
// ENGINE, PROVIDERS & PERSONAS
// ============================================================================

export type ProviderType =
  "ollama" | "lm-studio" | "openai-compatible" | "gemini";

export interface ProviderConfig {
  baseUrl: string;
  encryptedApiKey?: string;
}

export interface EngineSettings {
  currentProvider: ProviderType;
  providers: Record<ProviderType, ProviderConfig>;
}

export interface SystemProfile {
  id: string;
  label: string;
  icon: string; // Stored as a generic literal matching key mapping dictionaries
  prompt: string;
  isSystemDefault?: boolean;
}

// ============================================================================
// UI COMPONENT PROPS & ONBOARDING
// ============================================================================

export type SettingsTab = "engine" | "appearance" | "personas";
export type OnboardingStep = "intro" | "setup" | "done";

export interface HeaderProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
}

export interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onSelectArtifact?: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onNewChat: () => void;
}

export interface MessageFormProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onImportClick?: () => void;
}

export interface PromptOptionsProps {
  activeTab: "dynamic" | "generic";
  setActiveTab: (tab: "dynamic" | "generic") => void;
  dynamicSuggestedPrompts: string[];
  onSubmit: (promptText: string) => void;
}

export interface ResponseTuningPopoverProps {
  idx: number;
  isTuning: boolean;
  popoverDirection: "above" | "below";
  popoverRef: React.RefObject<HTMLDivElement | null>;
  values: TuningOverrides;
  onChange: (next: TuningOverrides) => void;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRegenerate: () => void;
}

export interface ObservedItemProps {
  msg: ChatDisplayMessage;
  idx: number;
  isLoading: boolean;
  isSplitPane?: boolean;
  onUpdateUserMessage?: (index: number, newContent: string) => void;
  activeArtifactAction?: string | null;
  onOpenArtifact?: (summary: string) => void;
  onSelectCitation?: (citationIndex: number) => void;
  onRegenerateFromCheckpoint?: (
    index: number,
    overrides: TuningOverrides,
  ) => void;
  sessionArtifactSummary?: string | null;
}

export interface ChatWindowProps {
  messages: ChatDisplayMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onUpdateUserMessage?: (index: number, newContent: string) => void;
  onRegenerateFromCheckpoint?: (
    index: number,
    overrides: TuningOverrides,
  ) => void;
  forceWorkspaceOpen?: boolean;
  inspectedArtifactId?: string | null;
}

export interface WorkspaceCanvasProps {
  sessionId: string;
  artifacts: WorkspaceArtifact[];
  activeArtifactId: string | null;
  isStreaming?: boolean;
  liveDraft?: LiveCanvasDraft | null;
  highlightedCitation?: HighlightedCitation | null;
  onClearHighlightedCitation?: () => void;
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

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export interface WelcomeModalProps {
  onComplete: () => void;
}

export interface LoadingDotsProps {
  className?: string;
  dotClassName?: string;
}
