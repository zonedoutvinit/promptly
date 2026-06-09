// src/components/MessageForm.tsx
import React from "react";

interface MessageFormProps {
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export const MessageForm: React.FC<MessageFormProps> = ({
  input,
  setInput,
  isLoading,
  onSubmit,
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="flex gap-2 pt-1 transition-colors duration-200"
    >
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={
          isLoading
            ? "Engine compiling response..."
            : "Enter structural text instructions..."
        }
        disabled={isLoading}
        className="flex-1 bg-theme-panel border border-theme-border rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-theme-accent/60 transition text-theme-text placeholder-theme-muted disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="bg-theme-accent hover:bg-theme-accent-hover disabled:bg-theme-panel disabled:text-theme-muted/50 font-medium px-5 rounded-xl text-sm transition-all text-theme-bg cursor-pointer active:scale-[0.98]"
      >
        Execute
      </button>
    </form>
  );
};
