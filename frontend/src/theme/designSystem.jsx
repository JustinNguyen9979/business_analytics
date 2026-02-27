// FILE: src/theme/designSystem.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth cho toàn bộ design system — Luxury Dark Tech
// Import file này vào mọi page/component thay vì định nghĩa lại từng chỗ.
// ─────────────────────────────────────────────────────────────────────────────

import { keyframes } from "@mui/material/styles";
import { styled }    from "@mui/material/styles";
import { Box, TextField, Typography, Stack } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";

/* =========================================================
   1. DESIGN TOKENS
========================================================= */
export const T = {
  // Backgrounds
  bg:          "#04080f",
  surface:     "#080e1a",
  panel:       "#0a1120",
  glass:       "rgba(10, 17, 32, 0.70)",

  // Borders
  border:      "rgba(255, 255, 255, 0.06)",
  borderHover: "rgba(255, 255, 255, 0.12)",

  // Brand colors
  primary:     "#2dd4bf",                       // Teal
  primaryDim:  "rgba(45, 212, 191, 0.12)",
  primaryGlow: "rgba(45, 212, 191, 0.30)",
  accent:      "#818cf8",                       // Indigo
  accentDim:   "rgba(129, 140, 248, 0.12)",
  gold:        "#f59e0b",

  // Semantic
  success:     "#34d399",
  error:       "#f87171",
  errorDim:    "rgba(248, 113, 113, 0.10)",
  warning:     "#f59e0b",
  warningDim:  "rgba(245, 158, 11, 0.08)",

  // Text
  textPrimary: "#f1f5f9",
  textSecond:  "#94a3b8",
  textMuted:   "#475569",

  // Typography
  fontDisplay: "'Sora', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
  fontBody:    "'DM Sans', sans-serif",

  // Radius
  radiusSm:    "8px",
  radiusMd:    "12px",
  radiusLg:    "20px",
  radiusFull:  "50px",
};

/* =========================================================
   2. KEYFRAMES
========================================================= */
export const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

export const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0);     }
`;

export const floatY = keyframes`
  0%, 100% { transform: translateY(0px)   rotate(0deg);   }
  33%       { transform: translateY(-14px) rotate(0.5deg); }
  66%       { transform: translateY(-7px)  rotate(-0.3deg);}
`;

export const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1);    }
  50%       { opacity: 0.8; transform: scale(1.05); }
`;

export const pulseFade = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;

export const scan = keyframes`
  0%   { top: -2px;  opacity: 0; }
  5%   { opacity: 0.6; }
  95%  { opacity: 0.6; }
  100% { top: 100%;  opacity: 0; }
`;

export const orbFloat = keyframes`
  0%   { transform: translate(0,     0)     scale(1);    }
  25%  { transform: translate(30px,  -20px) scale(1.05); }
  50%  { transform: translate(-20px, 30px)  scale(0.95); }
  75%  { transform: translate(20px,  10px)  scale(1.02); }
  100% { transform: translate(0,     0)     scale(1);    }
`;

export const spinnerAnim = keyframes`
  to { transform: rotate(360deg); }
`;

/* =========================================================
   3. SHARED BACKGROUND LAYER COMPONENTS
      Dùng chung ở cả AuthPage và BrandLobby (và mọi page mới)
========================================================= */

/** Noise texture toàn màn hình — tạo cảm giác film grain cao cấp */
export const Noise = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: 0,
    pointerEvents: "none", opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "128px 128px",
  }} />
);

/** 3 ambient orbs teal / indigo / gold chuyển động chậm */
export const AmbientOrbs = () => (
  <Box sx={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
    {[
      { size: 700, top: "-20%", left: "-10%",  color: T.primary, delay: "0s",   dur: "20s" },
      { size: 600, bottom: "-20%", right: "-8%", color: T.accent, delay: "7s",   dur: "25s" },
      { size: 350, top: "35%",  left: "38%",  color: T.gold,   delay: "3.5s", dur: "17s" },
    ].map((o, i) => (
      <Box key={i} sx={{
        position: "absolute", width: o.size, height: o.size,
        top: o.top, bottom: o.bottom, left: o.left, right: o.right,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${o.color}15 0%, transparent 70%)`,
        animation: `${orbFloat} ${o.dur} ease-in-out infinite`,
        animationDelay: o.delay,
        filter: "blur(2px)",
      }} />
    ))}
  </Box>
);

/** Grid perspective mờ — hướng tâm ra ngoài */
export const GridOverlay = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(${T.border} 1px, transparent 1px),
      linear-gradient(90deg, ${T.border} 1px, transparent 1px)
    `,
    backgroundSize: "80px 80px",
    maskImage: "radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 100%)",
  }} />
);

/** Scan line chạy từ trên xuống dưới */
export const ScanLine = () => (
  <Box sx={{
    position: "fixed", left: 0, right: 0, height: "1px", zIndex: 5, pointerEvents: "none",
    background: `linear-gradient(90deg, transparent 0%, ${T.primary}50 50%, transparent 100%)`,
    animation: `${scan} 8s ease-in-out infinite`,
  }} />
);

/* =========================================================
   4. SHARED STYLED COMPONENTS
========================================================= */

/** Input field với error state — dùng cho AuthPage và mọi Dialog */
export const StyledInput = styled(TextField, {
  shouldForwardProp: p => p !== "hasError",
})(({ hasError }) => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: hasError ? T.errorDim : "rgba(255,255,255,0.03)",
    borderRadius: T.radiusMd,
    color: T.textPrimary,
    fontFamily: T.fontBody,
    fontSize: "0.9rem",
    transition: "all 0.25s ease",
    "& fieldset": {
      borderColor: hasError ? T.error : T.border,
      borderWidth: "1px",
    },
    "&:hover fieldset": { borderColor: hasError ? T.error : T.borderHover },
    "&.Mui-focused": {
      backgroundColor: hasError ? T.errorDim : "rgba(45, 212, 191, 0.04)",
      boxShadow: hasError ? `0 0 0 3px ${T.errorDim}` : `0 0 0 3px ${T.primaryGlow}`,
      "& fieldset": { borderColor: hasError ? T.error : T.primary },
    },
  },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": {
    fontSize: "18px",
    color: hasError ? T.error : T.textMuted,
    transition: "color 0.2s",
  },
  "& .MuiFormHelperText-root": {
    color: T.error,
    fontFamily: T.fontBody,
    fontSize: "0.75rem",
  },
  "& input": {
    padding: "13px 14px 13px 6px",
    fontFamily: T.fontBody,
    "&::placeholder": { color: T.textMuted, opacity: 1 },
  },
  "& input:-webkit-autofill": {
    WebkitBoxShadow: `0 0 0 100px ${T.panel} inset`,
    WebkitTextFillColor: T.textPrimary,
  },
}));

/** Dialog Paper sx — dùng cho mọi Dialog trong app */
export const dialogPaperSx = {
  borderRadius: T.radiusLg,
  backgroundColor: "rgba(8, 14, 26, 0.88)",
  backdropFilter: "blur(24px) saturate(150%)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid ${T.border}`,
  boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
  fontFamily: T.fontBody,
  overflow: "visible",
};

/** Backdrop sx dùng cho Dialog */
export const dialogBackdropSx = {
  backdropFilter: "blur(8px)",
  bgcolor: "rgba(4, 8, 15, 0.65)",
};

/* =========================================================
   5. SMALL REUSABLE UI COMPONENTS
========================================================= */

/** Wrapper cho từng field — tự điều chỉnh margin-bottom */
export const FieldWrap = ({ children, error }) => (
  <Box sx={{ mb: error ? 0.5 : 2 }}>{children}</Box>
);

/** Error message nhỏ dưới input */
export const ErrMsg = ({ msg }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, mb: 1.5 }}>
    <ErrorOutline sx={{ fontSize: 13, color: T.error }} />
    <Typography sx={{ color: T.error, fontSize: "0.73rem", fontFamily: T.fontBody }}>
      {msg}
    </Typography>
  </Box>
);

/** 3 chấm loading animation */
export const LoadingDots = () => (
  <Stack direction="row" spacing={0.3} alignItems="center">
    {[0, 1, 2].map(i => (
      <Box key={i} sx={{
        width: 4, height: 4, borderRadius: "50%", bgcolor: T.textMuted,
        animation: `${pulse} 1.2s ease-in-out infinite`,
        animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </Stack>
);

/** Loading screen toàn trang */
export const LoadingScreen = () => (
  <Box sx={{
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    height: "100vh", backgroundColor: T.bg, gap: 3,
    fontFamily: T.fontBody,
  }}>
    <Noise />
    <AmbientOrbs />
    <Box sx={{
      width: 44, height: 44, borderRadius: "50%",
      border: `2px solid ${T.border}`,
      borderTopColor: T.primary,
      animation: `${spinnerAnim} 0.8s linear infinite`,
    }} />
    <Typography sx={{
      fontFamily: T.fontMono, fontSize: "0.72rem",
      color: T.textMuted, letterSpacing: "2px", textTransform: "uppercase",
    }}>
      Đang tải dữ liệu…
    </Typography>
  </Box>
);

/** Accent bar dọc — dùng trước heading trong Dialog và section */
export const AccentBar = ({ color = T.primary, height = 22 }) => (
  <Box sx={{
    width: 3, height, borderRadius: "2px",
    bgcolor: color,
    boxShadow: `0 0 10px ${color}80`,
    flexShrink: 0,
  }} />
);

/** Live indicator badge */
export const LiveBadge = () => (
  <Box sx={{
    display: "inline-flex", alignItems: "center", gap: 1,
    px: 1.5, py: 0.75, borderRadius: T.radiusFull,
    border: `1px solid ${T.success}30`,
    bgcolor: `${T.success}10`,
  }}>
    <Box sx={{
      width: 6, height: 6, borderRadius: "50%", bgcolor: T.success,
      animation: `${pulseFade} 2s ease-in-out infinite`,
      boxShadow: `0 0 6px ${T.success}`,
    }} />
    <Typography sx={{
      fontFamily: T.fontMono, fontSize: "0.6rem",
      color: T.success, letterSpacing: "1px",
    }}>
      LIVE
    </Typography>
  </Box>
);

/** Gradient shimmer text — dùng cho tiêu đề nổi bật */
export const ShimmerText = ({ children, sx = {} }) => (
  <Box component="span" sx={{
    background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent} 100%)`,
    backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent",
    backgroundSize: "200% auto",
    animation: `${shimmer} 4s linear infinite`,
    ...sx,
  }}>
    {children}
  </Box>
);

/** Eyebrow label — label nhỏ mono phía trên heading */
export const EyebrowLabel = ({ children }) => (
  <Box sx={{
    display: "inline-flex", alignItems: "center", gap: 1, mb: 2,
    px: 2, py: 0.75, borderRadius: T.radiusFull,
    border: `1px solid ${T.primary}30`,
    bgcolor: T.primaryDim,
  }}>
    <Box sx={{
      width: 5, height: 5, borderRadius: "50%",
      bgcolor: T.primary, boxShadow: `0 0 8px ${T.primary}`,
      animation: `${pulseFade} 2s infinite`,
    }} />
    <Typography sx={{
      fontFamily: T.fontMono, fontSize: "0.62rem",
      color: T.primary, letterSpacing: "2px", textTransform: "uppercase",
    }}>
      {children}
    </Typography>
  </Box>
);