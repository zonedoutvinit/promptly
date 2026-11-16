// src/components/EmptyStateCanvas.tsx
import React from "react";
import { Zap } from "lucide-react";

export const EmptyStateCanvas: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center text-theme-muted space-y-3 text-center select-none">
      <div className="h-12 w-12 rounded-2xl bg-theme-panel border border-theme-border flex items-center justify-center text-theme-accent font-bold text-lg shadow-sm">
        <Zap className="w-4 h-4 fill-theme-accent/10 stroke-[2.5]" />
      </div>
      <div>
        <p className="text-base font-medium text-theme-text">
          Promptly is offline-ready.
        </p>
        <p className="text-xs text-theme-muted max-w-xs mt-1">
          Select an active model from your system configuration menu above to
          begin a session.
        </p>
      </div>
    </div>
  );
};
