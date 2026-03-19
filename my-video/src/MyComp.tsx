import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  staticFile,
  Sequence,
} from "remotion";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreenConfig {
  file: string;
  label: string;
  navLabel: string;
  navX: number;
  clickX: number;
  clickY: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SCREENS: ScreenConfig[] = [
  {
    file: "home.png",
    label: "Início",
    navLabel: "Início",
    navX: 261,
    clickX: 261,
    clickY: 47,
  },
  {
    file: "servicos.png",
    label: "Nossos Serviços",
    navLabel: "Serviços",
    navX: 347,
    clickX: 347,
    clickY: 47,
  },
  {
    file: "planos.png",
    label: "Escolha seu Plano",
    navLabel: "Planos",
    navX: 432,
    clickX: 432,
    clickY: 47,
  },
  {
    file: "paciente.png",
    label: "Área do Paciente",
    navLabel: "Área do Paciente",
    navX: 1010,
    clickX: 1010,
    clickY: 92,
  },
  {
    file: "quemsomos.png",
    label: "Quem Somos",
    navLabel: "Quem Somos",
    navX: 878,
    clickX: 878,
    clickY: 47,
  },
];

// Each screen shows for 2s + 0.5s transition = 75 frames each
// total = 5 * 90 = 450 frames @ 30fps = 15s
const FRAMES_PER_SCREEN = 90;
const TRANSITION_FRAMES = 20;
const CURSOR_TRAVEL_FRAMES = 30;

// ─── Animated Cursor ─────────────────────────────────────────────────────────

const Cursor: React.FC<{
  x: number;
  y: number;
  clicking: boolean;
  opacity: number;
}> = ({ x, y, clicking, opacity }) => {
  const scale = clicking ? 0.8 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x - 12,
        top: y - 4,
        opacity,
        transition: "transform 0.05s",
        transform: `scale(${scale})`,
        pointerEvents: "none",
        zIndex: 100,
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
      }}
    >
      <svg width="28" height="32" viewBox="0 0 28 32" fill="none">
        <path
          d="M4 2L4 24L9 19L12.5 27L15 26L11.5 18H18L4 2Z"
          fill="white"
          stroke="#1a1a1a"
          strokeWidth="1.5"
        />
      </svg>
    </div>
  );
};

// ─── Click Ripple ─────────────────────────────────────────────────────────────

const ClickRipple: React.FC<{ x: number; y: number; progress: number }> = ({
  x,
  y,
  progress,
}) => {
  const size = interpolate(progress, [0, 1], [0, 80]);
  const opacity = interpolate(progress, [0, 0.3, 1], [0.8, 0.6, 0]);
  return (
    <div
      style={{
        position: "absolute",
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        border: "2px solid #2d9a6b",
        opacity,
        pointerEvents: "none",
        zIndex: 99,
      }}
    />
  );
};

// ─── Nav Highlight ────────────────────────────────────────────────────────────

const NavHighlight: React.FC<{ x: number; opacity: number }> = ({
  x,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      left: x - 40,
      top: 36,
      width: 80,
      height: 28,
      borderRadius: 6,
      background: "rgba(45,154,107,0.25)",
      border: "1.5px solid rgba(45,154,107,0.7)",
      opacity,
      pointerEvents: "none",
      zIndex: 98,
    }}
  />
);

// ─── Screen Label ─────────────────────────────────────────────────────────────

const ScreenLabel: React.FC<{ label: string; opacity: number }> = ({
  label,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 40,
      left: "50%",
      transform: "translateX(-50%)",
      background: "rgba(10,10,10,0.82)",
      color: "#fff",
      padding: "10px 28px",
      borderRadius: 30,
      fontSize: 18,
      fontFamily: "Inter, sans-serif",
      fontWeight: 600,
      letterSpacing: 0.3,
      opacity,
      zIndex: 101,
      backdropFilter: "blur(6px)",
      border: "1px solid rgba(255,255,255,0.15)",
    }}
  >
    {label}
  </div>
);

// ─── Screen Scene ────────────────────────────────────────────────────────────

const ScreenScene: React.FC<{
  screenIndex: number;
  globalFrame: number;
  startFrame: number;
}> = ({ screenIndex, globalFrame, startFrame }) => {
  const { fps } = useVideoConfig();
  const localFrame = globalFrame - startFrame;
  const screen = SCREENS[screenIndex];
  const nextScreen = SCREENS[screenIndex + 1];

  // Phases within this scene:
  // 0–10  : fade in
  // 10–50 : cursor travels to nav button
  // 50–65 : cursor hovers + highlight blinks
  // 65–75 : click + ripple
  // 75–90 : hold + fade out
  const fadeIn = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    localFrame,
    [FRAMES_PER_SCREEN - TRANSITION_FRAMES, FRAMES_PER_SCREEN],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = screenIndex === SCREENS.length - 1 ? fadeIn : Math.min(fadeIn, fadeOut);

  // Cursor animation: starts from center bottom, moves to nav button
  const cursorStartX = 640;
  const cursorStartY = 400;
  const targetX = nextScreen ? nextScreen.navX : screen.navX;
  const targetY = nextScreen ? nextScreen.clickY : screen.clickY;

  const travelProgress = spring({
    frame: localFrame - 15,
    fps,
    config: { damping: 18, stiffness: 60, mass: 1 },
    durationInFrames: CURSOR_TRAVEL_FRAMES,
  });

  const cursorX = interpolate(travelProgress, [0, 1], [cursorStartX, targetX]);
  const cursorY = interpolate(travelProgress, [0, 1], [cursorStartY, targetY]);

  const cursorOpacity = interpolate(localFrame, [5, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Highlight: appears as cursor hovers
  const highlightOpacity = interpolate(localFrame, [45, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Click: frame 65–75
  const isClicking = localFrame >= 65 && localFrame <= 72;
  const clickProgress = interpolate(localFrame, [65, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Label fade
  const labelOpacity = interpolate(localFrame, [8, 20, 68, 78], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Img
        src={staticFile(screen.file)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Nav button highlight */}
      {nextScreen && (
        <NavHighlight x={nextScreen.navX} opacity={highlightOpacity} />
      )}

      {/* Click ripple */}
      {nextScreen && clickProgress > 0 && (
        <ClickRipple x={targetX} y={targetY} progress={clickProgress} />
      )}

      {/* Cursor */}
      <Cursor
        x={cursorX}
        y={cursorY}
        clicking={isClicking}
        opacity={cursorOpacity}
      />

      {/* Screen label */}
      <ScreenLabel label={screen.label} opacity={labelOpacity} />
    </AbsoluteFill>
  );
};

// ─── Main Composition ─────────────────────────────────────────────────────────

export const MyComp: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {SCREENS.map((_, i) => {
        const startFrame = i * FRAMES_PER_SCREEN;
        const endFrame = startFrame + FRAMES_PER_SCREEN;

        // Render a bit before & after for overlap transitions
        const renderStart = startFrame - TRANSITION_FRAMES;
        const renderEnd = endFrame + TRANSITION_FRAMES;

        if (frame < renderStart || frame > renderEnd) return null;

        return (
          <ScreenScene
            key={i}
            screenIndex={i}
            globalFrame={frame}
            startFrame={startFrame}
          />
        );
      })}
    </AbsoluteFill>
  );
};
