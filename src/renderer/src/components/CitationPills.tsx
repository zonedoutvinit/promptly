import React from "react";

export function renderTextWithCitations(
  node: React.ReactNode,
  onSelectCitation?: (citationIndex: number) => void,
): React.ReactNode {
  if (typeof node === "string") {
    const citationSplitRegex = /(\[\s*cite\s*:\s*\d+(?:\s*,\s*\d+)*\s*\])/gi;
    const citationMatchRegex = /^\[\s*cite\s*:\s*(\d+(?:\s*,\s*\d+)*)\s*\]$/i;

    const parts = node.split(citationSplitRegex);
    if (parts.length === 1) return node;

    return parts.map((part, i) => {
      const match = citationMatchRegex.exec(part.trim());
      if (!match) return part;

      const nums = match[1]
        .split(",")
        .map((n) => Number(n.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);

      if (nums.length === 0) return part;

      return (
        <span
          key={`cite-group-${i}`}
          className="inline-flex items-center align-baseline mx-0.5 gap-1"
        >
          {nums.map((citationNum, j) => (
            <button
              key={`cite-${citationNum}-${i}-${j}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectCitation?.(citationNum);
              }}
              title={`Inspect Source ${citationNum} in Canvas`}
              className="inline-flex items-center align-baseline px-1.5 py-0.2 rounded-md text-[10px] font-mono font-semibold bg-theme-accent/15 hover:bg-theme-accent/25 text-theme-accent border border-theme-accent/35 transition-colors cursor-pointer"
            >
              cite:{citationNum}
            </button>
          ))}
        </span>
      );
    });
  }

  if (Array.isArray(node)) {
    return node.map((child, i) => (
      <React.Fragment key={i}>
        {renderTextWithCitations(child, onSelectCitation)}
      </React.Fragment>
    ));
  }

  return node;
}
