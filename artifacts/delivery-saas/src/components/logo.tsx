interface LogoProps {
  /** `full` includes TL mark + wordmark + slogan; `wordmark` is wordmark + slogan only (horizontal) */
  variant?: "full" | "wordmark";
  /** Height in px */
  heightPx?: number;
  className?: string;
}

const BASE = import.meta.env.BASE_URL;

export function Logo({ variant = "full", heightPx, className }: LogoProps) {
  const src =
    variant === "wordmark"
      ? `${BASE}brand/tiempolibre-wordmark.jpg`
      : `${BASE}brand/tiempolibre-logo.jpg`;
  const h = heightPx ?? (variant === "wordmark" ? 44 : 110);
  return (
    <img
      src={src}
      alt="TiempoLibre - Somos tu sistema de reparto"
      style={{ height: h, width: "auto" }}
      className={className}
      draggable={false}
      data-testid="logo"
    />
  );
}
