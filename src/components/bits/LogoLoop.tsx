import React, { useRef, useEffect } from "react";
import "./logo-loop.css";

interface Logo {
  title: string;
  node: React.ReactNode;
}

interface LogoLoopProps {
  logos: Logo[];
  speed?: number;
  direction?: "left" | "right";
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  scaleOnHover?: boolean;
  fadeOut?: boolean;
  fadeOutColor?: string;
  ariaLabel?: string;
}

export default function LogoLoop({
  logos,
  speed = 50,
  direction = "left",
  logoHeight = 20,
  gap = 16,
  pauseOnHover = false,
  scaleOnHover = false,
  fadeOut = false,
  fadeOutColor = "#ffffff",
  ariaLabel = "Logo carousel"
}: LogoLoopProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set CSS variables
    container.style.setProperty("--logo-height", `${logoHeight}px`);
    container.style.setProperty("--gap", `${gap}px`);
    container.style.setProperty("--speed", `${speed}s`);
    container.style.setProperty("--direction", direction === "left" ? "normal" : "reverse");
    
    if (fadeOut) {
      container.style.setProperty("--fade-color", fadeOutColor);
    }
  }, [logoHeight, gap, speed, direction, fadeOut, fadeOutColor]);

  return (
    <div
      ref={containerRef}
      className={`logo-loop ${pauseOnHover ? "pause-on-hover" : ""} ${scaleOnHover ? "scale-on-hover" : ""} ${fadeOut ? "fade-out" : ""}`}
      aria-label={ariaLabel}
    >
      <div className="logo-track">
        {/* First set of logos */}
        {logos.map((logo, index) => (
          <div key={`first-${index}`} className="logo-item" title={logo.title}>
            {logo.node}
          </div>
        ))}
        {/* Duplicate set for seamless loop */}
        {logos.map((logo, index) => (
          <div key={`second-${index}`} className="logo-item" title={logo.title}>
            {logo.node}
          </div>
        ))}
      </div>
    </div>
  );
}