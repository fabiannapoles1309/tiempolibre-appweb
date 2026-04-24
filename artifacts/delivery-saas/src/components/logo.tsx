import type { CSSProperties } from "react";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showSlogan?: boolean;
  monoLight?: boolean;
}

const SIZES = {
  sm: { mark: 28, font: 18, slogan: 8 },
  md: { mark: 40, font: 26, slogan: 9.5 },
  lg: { mark: 56, font: 38, slogan: 12 },
} as const;

export function Logo({ size = "md", showSlogan = true, monoLight = false }: LogoProps) {
  const s = SIZES[size];
  const cyan = monoLight ? "#FFFFFF" : "#00B5E2";
  const ink = monoLight ? "#FFFFFF" : "#0B1E2D";

  return (
    <div className="inline-flex items-center gap-3 select-none" data-testid="logo">
      <svg
        width={s.mark}
        height={s.mark}
        viewBox="0 0 56 56"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="56" height="56" rx="12" fill={cyan} />
        {/* T */}
        <rect x="9" y="14" width="18" height="4.5" rx="1.5" fill="#FFFFFF" />
        <rect x="15.75" y="14" width="4.5" height="28" rx="1.5" fill="#FFFFFF" />
        {/* L */}
        <rect x="31" y="14" width="4.5" height="28" rx="1.5" fill="#FFFFFF" />
        <rect x="31" y="37.5" width="16" height="4.5" rx="1.5" fill="#FFFFFF" />
      </svg>
      <div className="flex flex-col leading-none">
        <div style={{ fontSize: s.font, fontWeight: 800, letterSpacing: "-0.02em" } as CSSProperties}>
          <span style={{ color: cyan }}>Tiempo</span>
          <span style={{ color: ink }}>Libre</span>
        </div>
        {showSlogan && (
          <div
            style={{
              fontSize: s.slogan,
              letterSpacing: "0.18em",
              color: monoLight ? "#FFFFFF" : "#5C6B78",
              marginTop: 4,
              fontWeight: 600,
            }}
          >
            SOMOS TU SISTEMA DE REPARTO
          </div>
        )}
      </div>
    </div>
  );
}
