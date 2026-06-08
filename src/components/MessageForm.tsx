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
    <form onSubmit={onSubmit} className="flex gap-2 pt-1">
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
        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 text-sm focus:outline-none focus:border-indigo-500 transition text-zinc-100 placeholder-zinc-600 disabled:opacity-40"
      />
      <button
        type="submit"
        disabled={isLoading || !input.trim()}
        className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-900 disabled:text-zinc-700 font-medium px-5 rounded-xl text-sm transition text-white"
      >
        Execute
      </button>
    </form>
  );
};
