import React from 'react';
import { Box, Typography } from '@mui/material';

// --- DESIGN TOKENS (Fixed: Using hex strings to allow hex-opacity appending) ---
const T = {
  bg:          "#04080f",
  border:      "rgba(255, 255, 255, 0.06)",
  primary:     "#2dd4bf",
  accent:      "#818cf8",
  gold:        "#f59e0b",
  success:     "#34d399",
};

// --- KEYFRAMES ---
const orbFloat = "orbFloat";
const scan = "scan";
const pulse = "pulse";

export const Noise = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat", backgroundSize: "128px 128px",
  }} />
);

export const AmbientOrbs = () => (
  <Box sx={{ position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none", overflow: "hidden" }}>
    {[
      { size: 700, top: "-20%", left: "-10%",  color: T.primary, delay: "0s",  dur: "20s" },
      { size: 600, bottom: "-20%", right: "-8%", color: T.accent,  delay: "7s",  dur: "25s" },
      { size: 350, top: "35%",  left: "38%",  color: T.gold,    delay: "3.5s", dur: "17s" },
    ].map((o, i) => (
      <Box key={i} sx={{
        position: "absolute", width: o.size, height: o.size,
        top: o.top, bottom: o.bottom, left: o.left, right: o.right,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${o.color}25 0%, transparent 70%)`,
        animation: `${orbFloat} ${o.dur} ease-in-out infinite`,
        animationDelay: o.delay,
        filter: "blur(2px)",
      }} />
    ))}
  </Box>
);

export const GridOverlay = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: -1, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(${T.border} 1px, transparent 1px),
      linear-gradient(90deg, ${T.border} 1px, transparent 1px)
    `,
    backgroundSize: "80px 80px",
    maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)",
  }} />
);

export const ScanLine = () => (
  <Box sx={{
    position: "fixed", left: 0, right: 0, height: "1px", zIndex: 5, pointerEvents: "none",
    background: `linear-gradient(90deg, transparent 0%, ${T.primary}50 50%, transparent 100%)`,
    animation: `${scan} 8s ease-in-out infinite`,
  }} />
);

export const LiveIndicator = () => (
  <Box sx={{ 
    display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
    borderRadius: "20px", border: `1px solid ${T.success}30`, bgcolor: `${T.success}10` 
  }}>
    <Box sx={{ 
      width: 6, height: 6, borderRadius: "50%", bgcolor: T.success,
      animation: `${pulse} 2s ease-in-out infinite`, boxShadow: `0 0 6px ${T.success}` 
    }} />
    <Typography sx={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", color: T.success, letterSpacing: "1px" }}>
      LIVE
    </Typography>
  </Box>
);
