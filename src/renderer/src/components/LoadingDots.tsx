import React from "react";

interface LoadingDotsProps {
  className?: string;
  dotClassName?: string;
}

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  className = "",
  dotClassName = "bg-theme-accent",
}) => {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <div
        className={`w-1.5 h-1.5 rounded-full animate-bounce ${dotClassName} [animation-delay:-0.3s]`}
      ></div>
      <div
        className={`w-1.5 h-1.5 rounded-full animate-bounce ${dotClassName} [animation-delay:-0.15s]`}
      ></div>
      <div
        className={`w-1.5 h-1.5 rounded-full animate-bounce ${dotClassName}`}
      ></div>
    </div>
  );
};
