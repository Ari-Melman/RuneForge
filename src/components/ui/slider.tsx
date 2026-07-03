import * as React from "react";

import { cn } from "@/lib/utils";

type SliderProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange"
> & {
  value?: number[];
  defaultValue?: number[];
  onValueChange?: (value: number[]) => void;
};

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value, defaultValue, onValueChange, min = 0, max = 100, step = 1, ...props }, ref) => {
    const currentValue = value?.[0] ?? defaultValue?.[0] ?? Number(min);
    const range = Math.max(1, Number(max) - Number(min));
    const progress = ((currentValue - Number(min)) / range) * 100;

    return (
      <div className="relative h-6">
        <input
          ref={ref}
          type="range"
          min={min}
          max={max}
          step={step}
          value={currentValue}
          onChange={(event) => onValueChange?.([Number(event.target.value)])}
          className={cn("rf-slider", className)}
          style={{ "--slider-progress": `${progress}%` } as React.CSSProperties}
          {...props}
        />
        <style>{`
          .rf-slider {
            width: 100%;
            height: 22px;
            border-radius: 9999px;
            appearance: none;
            -webkit-appearance: none;
            background: transparent;
            outline: none;
            cursor: pointer;
          }
          .rf-slider::-webkit-slider-runnable-track {
            height: 5px;
            border-radius: 9999px;
            background: linear-gradient(
              to right,
              rgba(219, 171, 58, 1) 0%,
              rgba(219, 171, 58, 1) var(--slider-progress),
              rgba(255, 255, 255, 0.15) var(--slider-progress),
              rgba(255, 255, 255, 0.15) 100%
            );
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
          .rf-slider::-moz-range-track {
            height: 5px;
            border-radius: 9999px;
            background: rgba(255, 255, 255, 0.16);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
          }
          .rf-slider::-moz-range-progress {
            height: 5px;
            border-radius: 9999px;
            background: rgba(219, 171, 58, 1);
          }
          .rf-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 16px;
            height: 16px;
            margin-top: -6px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 224, 139, 0.22);
            background: #e0b33f;
            box-shadow:
              0 0 0 1px rgba(0, 0, 0, 0.35),
              0 4px 10px rgba(0, 0, 0, 0.3);
          }
          .rf-slider::-moz-range-thumb {
            width: 16px;
            height: 16px;
            border-radius: 9999px;
            border: 1px solid rgba(255, 224, 139, 0.22);
            background: #e0b33f;
            box-shadow:
              0 0 0 1px rgba(0, 0, 0, 0.35),
              0 4px 10px rgba(0, 0, 0, 0.3);
          }
          .rf-slider:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }
        `}</style>
      </div>
    );
  },
);
Slider.displayName = "Slider";

export { Slider };
