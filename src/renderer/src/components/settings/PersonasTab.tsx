// src/components/settings/PersonasTab.tsx
import React from "react";
import { SystemProfile } from "../../store";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal,
} from "lucide-react";

const IconMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  PenTool,
  Code,
  BrainCircuit,
  Terminal,
};

interface PersonasTabProps {
  customPersonas: SystemProfile[];
  selectedPersonaId: string | null;
  isCreatingNew: boolean;
  personaLabel: string;
  personaIcon: string;
  personaPrompt: string;
  onLoadPersona: (p: SystemProfile) => void;
  onInitNewPersona: () => void;
  onDeletePersona: (id: string) => void;
  onLabelChange: (val: string) => void;
  onIconChange: (val: string) => void;
  onPromptChange: (val: string) => void;
  onSavePersona: () => void;
}

export const PersonasTab: React.FC<PersonasTabProps> = ({
  customPersonas,
  selectedPersonaId,
  isCreatingNew,
  personaLabel,
  personaIcon,
  personaPrompt,
  onLoadPersona,
  onInitNewPersona,
  onDeletePersona,
  onLabelChange,
  onIconChange,
  onPromptChange,
  onSavePersona,
}) => {
  const currentPersona = customPersonas.find((p) => p.id === selectedPersonaId);
  const isSystemDefault = currentPersona?.isSystemDefault && !isCreatingNew;

  return (
    <div className="grid grid-cols-5 gap-4 h-full min-h-100 animate-chipFade">
      {/* Sidebar List */}
      <div className="col-span-2 flex flex-col border border-theme-border/60 rounded-xl bg-theme-panel/20 overflow-hidden">
        <div className="p-2 border-b border-theme-border/60 bg-theme-panel/40 flex items-center justify-between shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-theme-muted">
            Active Catalogs
          </span>
          <button
            type="button"
            onClick={onInitNewPersona}
            className="p-1 rounded-md bg-theme-accent text-theme-bg hover:bg-theme-accent-hover transition cursor-pointer"
          >
            <Plus className="w-3 h-3 stroke-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {customPersonas.map((p) => {
            const ItemIcon = IconMap[p.icon] || Terminal;
            const isSelected = selectedPersonaId === p.id && !isCreatingNew;
            return (
              <div
                key={p.id}
                onClick={() => onLoadPersona(p)}
                className={`group w-full flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                  isSelected
                    ? "bg-theme-panel text-theme-accent border border-theme-border"
                    : "text-theme-text hover:bg-theme-panel/40"
                }`}
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <ItemIcon
                    className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-theme-accent" : "text-theme-muted"}`}
                  />
                  <span className="text-xs font-medium truncate">
                    {p.label}
                  </span>
                </div>

                {!p.isSystemDefault && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePersona(p.id);
                    }}
                    className="text-theme-muted hover:text-red-400 p-1 rounded transition shrink-0 cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100 animate-fade-in"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Editor Space */}
      <div className="col-span-3 flex flex-col space-y-3 bg-theme-panel/10 p-3 rounded-xl border border-theme-border/40">
        <div className="flex items-center gap-1.5 text-xs text-theme-muted font-bold uppercase tracking-wide border-b border-theme-border/40 pb-1.5">
          <Edit2 className="w-3.5 h-3.5 text-theme-accent" />
          <span>
            {isCreatingNew
              ? "Construct Custom Starter"
              : "Modify Blueprint Config"}
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
            Display Label Name
          </label>
          <input
            type="text"
            disabled={isSystemDefault}
            value={personaLabel}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Legal Contract Reviewer"
            className="w-full bg-theme-panel border border-theme-border rounded-lg p-2 text-xs font-medium text-theme-text focus:outline-none focus:border-theme-accent/60 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
            Visual Interface Icon Archetype
          </label>
          <div className="grid grid-cols-5 gap-1">
            {Object.keys(IconMap).map((iconKey) => {
              const IconChoice = IconMap[iconKey];
              const isChosen = personaIcon === iconKey;
              return (
                <button
                  key={iconKey}
                  type="button"
                  disabled={isSystemDefault}
                  onClick={() => onIconChange(iconKey)}
                  className={`p-2 border rounded-lg flex items-center justify-center transition cursor-pointer disabled:opacity-40 ${
                    isChosen
                      ? "bg-theme-accent/10 border-theme-accent text-theme-accent"
                      : "bg-theme-panel/40 border-theme-border hover:border-theme-text/30 text-theme-muted"
                  }`}
                >
                  <IconChoice className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col space-y-1 min-h-35">
          <label className="text-[10px] font-bold text-theme-muted uppercase tracking-wider">
            System Directives Context Injector Payload
          </label>
          <textarea
            disabled={isSystemDefault}
            value={personaPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
            placeholder="Enter specific contextual behaviors, constraint boundaries..."
            className="w-full flex-1 bg-theme-panel border border-theme-border rounded-lg p-2.5 text-xs text-theme-text focus:outline-none focus:border-theme-accent/60 font-mono resize-none leading-relaxed disabled:opacity-50"
          />
        </div>

        {!isSystemDefault ? (
          <button
            type="button"
            onClick={onSavePersona}
            disabled={!personaLabel.trim() || !personaPrompt.trim()}
            className="w-full bg-theme-accent/10 hover:bg-theme-accent text-theme-accent hover:text-theme-bg border border-theme-accent/30 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Apply Document Blueprint changes</span>
          </button>
        ) : (
          <div className="text-[10px] text-theme-muted font-mono bg-theme-panel/40 p-2 rounded-lg border border-theme-border/40 text-center">
            🔒 Core factory profiles are locked from deletion/modifications.
          </div>
        )}
      </div>
    </div>
  );
};
