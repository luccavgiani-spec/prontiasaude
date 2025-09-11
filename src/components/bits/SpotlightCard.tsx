import React, { useRef } from "react";
import "./spotlight-card.css";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  spotlightColor?: string;
};

export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(22, 163, 74, 0.18)", // tom de verde do brand
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const setPos = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--mouse-x", `${x}px`);
    el.style.setProperty("--mouse-y", `${y}px`);
    el.style.setProperty("--spotlight-color", spotlightColor);
  };

  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const rect = ref.current!.getBoundingClientRect();
        setPos(e.clientX - rect.left, e.clientY - rect.top);
      }}
      onPointerLeave={() => setPos(-9999, -9999)}
      className={`card-spotlight ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}