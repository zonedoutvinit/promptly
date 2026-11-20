// src/components/ResponseTuningPopover.tsx
import React, { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Settings, SlidersHorizontal, HelpCircle } from "lucide-react";

export interface TuningOverrides {
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

interface ResponseTuningPopoverProps {
  idx: number;
  isTuning: boolean;
  popoverDirection: "above" | "below";
  popoverRef: React.RefObject<HTMLDivElement | null>;
  values: TuningOverrides;
  onChange: (next: TuningOverrides) => void;
  onToggle: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onRegenerate: () => void;
}

export const ResponseTuningPopover: React.FC<ResponseTuningPopoverProps> = ({
  idx,
  isTuning,
  popoverDirection,
  popoverRef,
  values,
  onChange,
  onToggle,
  onRegenerate,
}) => {
  const { temperature, topP, frequencyPenalty, presencePenalty } = values;
  const [buttonRef, setButtonRef] = useState<HTMLButtonElement | null>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!isTuning || !buttonRef) {
      setCoords(null);
      return;
    }

    const updatePosition = () => {
      const rect = buttonRef.getBoundingClientRect();
      const popoverWidth = 288; // w-72 = 18rem = 288px
      const left = Math.max(
        12,
        Math.min(
          rect.right - popoverWidth,
          window.innerWidth - popoverWidth - 12,
        ),
      );
      const top = popoverDirection === "above" ? rect.top - 8 : rect.bottom + 6;

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isTuning, buttonRef, popoverDirection]);

  const sliderClass =
    "w-full h-1 bg-theme-bg rounded-lg cursor-pointer appearance-none accent-theme-accent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-theme-accent [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-theme-accent [&::-moz-range-thumb]:border-0";

  const popoverNode =
    isTuning && coords
      ? createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: popoverDirection === "above" ? "auto" : `${coords.top}px`,
              bottom:
                popoverDirection === "above"
                  ? `${window.innerHeight - coords.top}px`
                  : "auto",
              left: `${coords.left}px`,
            }}
            className="z-9999 w-72 bg-theme-panel border border-theme-border rounded-xl shadow-2xl p-4 space-y-4 text-theme-text cursor-default text-left animate-in fade-in duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-theme-muted uppercase tracking-wider border-b border-theme-border/40 pb-1.5">
              <SlidersHorizontal className="w-3 h-3 text-theme-accent" />
              <span>Response Tuning</span>
            </div>

            <div className="space-y-3.5">
              {/* Creativity (Temperature) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text/90 font-medium flex items-center gap-1">
                    Creativity
                    <span
                      className="cursor-help text-theme-muted"
                      title="Higher values make the response more imaginative and random."
                    >
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </span>
                  <span className="text-theme-accent font-mono font-semibold bg-theme-bg px-1.5 py-0.5 rounded text-[11px]">
                    {temperature === 0
                      ? "Factual"
                      : temperature > 1.0
                        ? "Wild"
                        : "Balanced"}{" "}
                    ({temperature.toFixed(1)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.05"
                  value={temperature}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      temperature: parseFloat(e.target.value),
                    })
                  }
                  className={sliderClass}
                />
              </div>

              {/* Word Pool (Top P) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text/90 font-medium flex items-center gap-1">
                    Word Pool
                    <span
                      className="cursor-help text-theme-muted"
                      title="Limits the AI to choosing words from a narrower pool."
                    >
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </span>
                  <span className="text-theme-accent font-mono font-semibold bg-theme-bg px-1.5 py-0.5 rounded text-[11px]">
                    {topP >= 0.9 ? "Wide" : topP > 0.4 ? "Normal" : "Strict"} (
                    {topP.toFixed(1)})
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={topP}
                  onChange={(e) =>
                    onChange({ ...values, topP: parseFloat(e.target.value) })
                  }
                  className={sliderClass}
                />
              </div>

              {/* Repetition Filter (Frequency Penalty) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text/90 font-medium flex items-center gap-1">
                    Repetition Filter
                    <span
                      className="cursor-help text-theme-muted"
                      title="Discourages the model from repeating the exact same words or phrases close together."
                    >
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </span>
                  <span className="text-theme-accent font-mono font-semibold bg-theme-bg px-1.5 py-0.5 rounded text-[11px]">
                    {frequencyPenalty === 0
                      ? "Off"
                      : frequencyPenalty > 0
                        ? "Strict"
                        : "Allowed"}{" "}
                    ({frequencyPenalty.toFixed(1)})
                  </span>
                </div>
                <input
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.1"
                  value={frequencyPenalty}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      frequencyPenalty: parseFloat(e.target.value),
                    })
                  }
                  className={sliderClass}
                />
              </div>

              {/* Topic Variation (Presence Penalty) */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-theme-text/90 font-medium flex items-center gap-1">
                    Topic Variation
                    <span
                      className="cursor-help text-theme-muted"
                      title="Encourages the AI to introduce new concepts and broader subjects instead of sticking to one lane."
                    >
                      <HelpCircle className="w-3 h-3" />
                    </span>
                  </span>
                  <span className="text-theme-accent font-mono font-semibold bg-theme-bg px-1.5 py-0.5 rounded text-[11px]">
                    {presencePenalty === 0
                      ? "Off"
                      : presencePenalty > 0
                        ? "Diverse"
                        : "Focused"}{" "}
                    ({presencePenalty.toFixed(1)})
                  </span>
                </div>
                <input
                  type="range"
                  min="-2.0"
                  max="2.0"
                  step="0.1"
                  value={presencePenalty}
                  onChange={(e) =>
                    onChange({
                      ...values,
                      presencePenalty: parseFloat(e.target.value),
                    })
                  }
                  className={sliderClass}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-theme-border/40">
              <button
                type="button"
                onClick={onRegenerate}
                className="w-full text-center py-2 bg-theme-accent text-theme-bg font-semibold rounded-lg text-xs hover:bg-theme-accent-hover transition active:scale-[0.98] cursor-pointer shadow-sm"
              >
                Regenerate Response
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={setButtonRef}
        type="button"
        data-tuning-toggle={idx}
        onClick={onToggle}
        className={`p-1 hover:bg-theme-panel rounded transition duration-150 cursor-pointer relative z-20 ${
          isTuning ? "text-theme-accent bg-theme-panel" : "text-theme-accent"
        }`}
        title="Tune generation settings"
      >
        <Settings className="w-3.5 h-3.5 stroke-[2.5]" />
      </button>
      {popoverNode}
    </>
  );
};
