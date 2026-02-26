import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { loginAPI, signupAPI } from "../services/api";
import {
  Box, Typography, Stack, TextField, Button,
  IconButton, InputAdornment, Checkbox, FormControlLabel,
  CssBaseline, List, ListItem, ListItemIcon, ListItemText
} from "@mui/material";
import {
  Visibility, VisibilityOff, EmailOutlined, LockOutlined,
  PersonOutline, ArrowForward, AssessmentOutlined,
  CheckCircle, RadioButtonUnchecked, ErrorOutline
} from "@mui/icons-material";
import { styled, keyframes } from "@mui/material/styles";

/* =========================================================
   DESIGN TOKENS — Luxury Dark Tech
========================================================= */
const T = {
  bg:          "#04080f",
  surface:     "#080e1a",
  panel:       "#0a1120",
  glass:       "rgba(10, 17, 32, 0.7)",
  border:      "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  primary:     "#2dd4bf",      // teal
  primaryDim:  "rgba(45, 212, 191, 0.15)",
  primaryGlow: "rgba(45, 212, 191, 0.35)",
  accent:      "#818cf8",      // indigo
  accentDim:   "rgba(129, 140, 248, 0.15)",
  gold:        "#f59e0b",
  textPrimary: "#f1f5f9",
  textSecond:  "#94a3b8",
  textMuted:   "#475569",
  error:       "#f87171",
  errorDim:    "rgba(248, 113, 113, 0.1)",
  success:     "#34d399",
  successDim:  "rgba(52, 211, 153, 0.1)",
  fontDisplay: "'Sora', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
  fontBody:    "'DM Sans', sans-serif",
};

/* =========================================================
   KEYFRAMES
========================================================= */
const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const floatY = keyframes`
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  33%       { transform: translateY(-14px) rotate(0.5deg); }
  66%       { transform: translateY(-7px) rotate(-0.3deg); }
`;
const pulse = keyframes`
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50%       { opacity: 0.8; transform: scale(1.05); }
`;
const scan = keyframes`
  0%   { top: -2px; opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { top: 100%; opacity: 0; }
`;
const orbFloat = keyframes`
  0%   { transform: translate(0, 0) scale(1); }
  25%  { transform: translate(30px, -20px) scale(1.05); }
  50%  { transform: translate(-20px, 30px) scale(0.95); }
  75%  { transform: translate(20px, 10px) scale(1.02); }
  100% { transform: translate(0, 0) scale(1); }
`;

/* =========================================================
   FONT INJECTION
========================================================= */
const FontInjector = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; }
    ::selection { background: ${T.primaryDim}; color: ${T.primary}; }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: ${T.bg}; }
    ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 2px; }
  `}</style>
);

/* =========================================================
   NOISE TEXTURE OVERLAY
========================================================= */
const Noise = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    backgroundRepeat: "repeat", backgroundSize: "128px 128px",
  }} />
);

/* =========================================================
   AMBIENT ORBS
========================================================= */
const AmbientOrbs = () => (
  <Box sx={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
    {[
      { size: 600, top: "-15%", left: "-10%", color: T.primary, delay: "0s", dur: "18s" },
      { size: 500, bottom: "-20%", right: "-5%", color: T.accent, delay: "6s", dur: "22s" },
      { size: 300, top: "40%", left: "30%", color: T.gold, delay: "3s", dur: "15s" },
    ].map((orb, i) => (
      <Box key={i} sx={{
        position: "absolute",
        width: orb.size, height: orb.size,
        top: orb.top, bottom: orb.bottom, left: orb.left, right: orb.right,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${orb.color}18 0%, transparent 70%)`,
        animation: `${orbFloat} ${orb.dur} ease-in-out infinite`,
        animationDelay: orb.delay,
        filter: "blur(1px)",
      }} />
    ))}
  </Box>
);

/* =========================================================
   GRID OVERLAY
========================================================= */
const GridOverlay = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
    backgroundImage: `
      linear-gradient(${T.border} 1px, transparent 1px),
      linear-gradient(90deg, ${T.border} 1px, transparent 1px)
    `,
    backgroundSize: "80px 80px",
    maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 40%, transparent 100%)",
  }} />
);

/* =========================================================
   DONUT CHART
========================================================= */
const DonutChart = ({ percent, color, size = 58 }) => {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
      </svg>
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography sx={{ color: "#fff", fontFamily: T.fontMono, fontSize: "0.65rem", fontWeight: 500 }}>
          {percent}%
        </Typography>
      </Box>
    </Box>
  );
};

/* =========================================================
   FLOATING WIDGET
========================================================= */
const Widget = ({ top, left, right, bottom, delay, children }) => (
  <Box sx={{
    position: "absolute", top, left, right, bottom,
    background: "rgba(8, 14, 26, 0.75)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: `1px solid ${T.border}`,
    borderRadius: "20px", padding: "20px 22px", width: 270, zIndex: 2,
    boxShadow: "0 30px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
    animation: `${floatY} 8s ease-in-out infinite`,
    animationDelay: delay || "0s",
  }}>
    {children}
  </Box>
);

/* =========================================================
   VALIDATION
========================================================= */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRITERIA = [
  { id: 1, label: "8–72 ký tự",             test: p => p.length >= 8 && p.length <= 72 },
  { id: 2, label: "Chữ hoa (A–Z)",          test: p => /[A-Z]/.test(p) },
  { id: 3, label: "Chữ thường (a–z)",       test: p => /[a-z]/.test(p) },
  { id: 4, label: "Chữ số (0–9)",           test: p => /[0-9]/.test(p) },
  { id: 5, label: "Ký tự đặc biệt (!@#…)", test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

/* =========================================================
   STYLED INPUT
========================================================= */
const StyledInput = styled(TextField, {
  shouldForwardProp: p => p !== "hasError",
})(({ hasError }) => ({
  "& .MuiOutlinedInput-root": {
    backgroundColor: hasError ? T.errorDim : "rgba(255,255,255,0.03)",
    borderRadius: "12px",
    color: T.textPrimary,
    fontFamily: T.fontBody,
    fontSize: "0.9rem",
    transition: "all 0.25s ease",
    "& fieldset": { borderColor: hasError ? T.error : T.border, borderWidth: "1px" },
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

/* =========================================================
   MAIN COMPONENT
========================================================= */
const AuthPage = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  const [values, setValues]   = useState({ username: "", fullName: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors]   = useState({});
  const [touched, setTouched] = useState({});

  const passStrength = CRITERIA.filter(c => c.test(values.password)).length;
  const strengthColors = ["#334155", T.error, "#f97316", T.gold, T.primary, T.success];
  const strengthLabels = ["", "Rất yếu", "Yếu", "Trung bình", "Tốt", "Mạnh"];

  const toggleMode = () => {
    setIsLogin(v => !v);
    setValues({ username: "", fullName: "", email: "", password: "", confirmPassword: "" });
    setErrors({});
    setTouched({});
    setApiError("");
    setSuccessMsg("");
    setShowPass(false);
    setShowConfirmPass(false);
    setAnimKey(k => k + 1);
  };

  const handleChange = field => e => {
    setValues(v => ({ ...v, [field]: e.target.value }));
    if (errors[field]) setErrors(v => ({ ...v, [field]: "" }));
  };

  const handleBlur = field => () => {
    setTouched(v => ({ ...v, [field]: true }));
    validateField(field);
  };

  const validateField = field => {
    let errs = { ...errors };
    const { username, fullName, email, password, confirmPassword } = values;

    if (field === "username") {
      if (!username.trim()) errs.username = "Vui lòng nhập tên đăng nhập.";
      else delete errs.username;
    }
    if (field === "fullName" && !isLogin) {
      if (!fullName.trim()) errs.fullName = "Vui lòng nhập họ và tên.";
      else delete errs.fullName;
    }
    if (field === "email") {
      if (!email) errs.email = "Vui lòng nhập email.";
      else if (!REGEX_EMAIL.test(email)) errs.email = "Định dạng email không hợp lệ.";
      else delete errs.email;
    }
    if (field === "password") {
      if (!password) errs.password = "Vui lòng nhập mật khẩu.";
      else if (!isLogin && !CRITERIA.every(c => c.test(password))) errs.password = "Mật khẩu chưa đủ mạnh.";
      else delete errs.password;
    }
    if (field === "confirmPassword" && !isLogin) {
      if (!confirmPassword) errs.confirmPassword = "Vui lòng xác nhận mật khẩu.";
      else if (confirmPassword !== password) errs.confirmPassword = "Mật khẩu không khớp.";
      else delete errs.confirmPassword;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ username: true, fullName: true, email: true, password: true, confirmPassword: true });

    let submitErrors = {};
    if (!values.username.trim()) submitErrors.username = "Vui lòng nhập tên đăng nhập.";
    
    if (!isLogin) {
        if (!values.fullName.trim()) submitErrors.fullName = "Vui lòng nhập họ và tên.";
        if (!values.email) submitErrors.email = "Vui lòng nhập email.";
        else if (!REGEX_EMAIL.test(values.email)) submitErrors.email = "Định dạng email không hợp lệ.";
    }

    if (!values.password) submitErrors.password = "Vui lòng nhập mật khẩu.";
    else if (!isLogin && !CRITERIA.every(c => c.test(values.password))) submitErrors.password = "Mật khẩu chưa đủ mạnh.";

    if (!isLogin) {
      if (!values.confirmPassword) submitErrors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
      else if (values.confirmPassword !== values.password) submitErrors.confirmPassword = "Mật khẩu không khớp.";
    }
    setErrors(submitErrors);

    if (Object.keys(submitErrors).length === 0) {
      setLoading(true);
      setApiError("");
      setSuccessMsg("");
      try {
        if (isLogin) {
          const data = await loginAPI({ username: values.username, password: values.password });
          localStorage.setItem("token", data.access_token);
          navigate("/");
        } else {
          await signupAPI({
            username: values.username,
            email: values.email,
            full_name: values.fullName,
            password: values.password
          });
          setIsLogin(true);
          setSuccessMsg("Đăng ký thành công! Vui lòng đăng nhập.");
          setShowPass(false);
          setShowConfirmPass(false);
        }
      } catch (err) {
        console.error("Auth error:", err);
        setApiError(err.response?.data?.detail || "Đã có lỗi xảy ra. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    }
  };

  /* --- UI --- */
  return (
    <>
      <FontInjector />
      <CssBaseline />
      <Box sx={{
        display: "flex", width: "100%", minHeight: "100vh",
        backgroundColor: T.bg, fontFamily: T.fontBody, position: "relative", overflow: "hidden",
      }}>
        <Noise />
        <AmbientOrbs />
        <GridOverlay />

        {/* ====== LEFT PANEL ====== */}
        <Box sx={{
          flex: 1, position: "relative", display: { xs: "none", md: "flex" },
          flexDirection: "column", justifyContent: "center", alignItems: "center",
          borderRight: `1px solid ${T.border}`, zIndex: 1, overflow: "hidden",
        }}>
          {/* Logo */}
          <Box sx={{ position: "absolute", top: 40, left: 44, display: "flex", alignItems: "center", gap: 1.5, zIndex: 3 }}>
            <Box sx={{
              width: 36, height: 36, borderRadius: "10px",
              background: `linear-gradient(135deg, ${T.primary}30, ${T.accent}30)`,
              border: `1px solid ${T.primary}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <AssessmentOutlined sx={{ color: T.primary, fontSize: 20 }} />
            </Box>
            <Typography sx={{
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem",
              color: T.textPrimary, letterSpacing: "0.04em",
            }}>
              ANALYTICS<Box component="span" sx={{ color: T.primary }}>PRO</Box>
            </Typography>
          </Box>

          {/* Hero text */}
          <Box sx={{ position: "relative", zIndex: 2, textAlign: "center", px: 6, mb: 12 }}>
            <Typography sx={{
              fontFamily: T.fontDisplay, fontWeight: 800, fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
              color: T.textPrimary, lineHeight: 1.2, mb: 3,
              textShadow: `0 0 80px ${T.primary}20`,
            }}>
              Quản trị Vận hành{" "}
              <Box component="span" sx={{
                background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent} 100%)`,
                backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent",
                backgroundSize: "200% auto",
                animation: `${shimmer} 4s linear infinite`,
              }}>
                Thông minh
              </Box>
            </Typography>
            <Typography sx={{ color: T.textSecond, fontFamily: T.fontBody, fontSize: "0.95rem", maxWidth: 440, mx: "auto", lineHeight: 1.7 }}>
              Theo dõi hiệu suất thời gian thực, phân tích xu hướng và đưa ra quyết định dựa trên dữ liệu chính xác.
            </Typography>
          </Box>

          {/* Widgets */}
          <Widget top="52%" left="8%" delay="0s">
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textMuted, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                Tỷ lệ hoàn thành
              </Typography>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: T.success, boxShadow: `0 0 8px ${T.success}` }} />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2}>
              <DonutChart percent={87} color={T.success} />
              <Box>
                <Typography sx={{ fontFamily: T.fontDisplay, color: "#fff", fontWeight: 700, fontSize: "1.4rem", lineHeight: 1 }}>87.4%</Typography>
                <Typography sx={{ color: T.success, fontSize: "0.72rem", fontFamily: T.fontMono, mt: 0.5 }}>↗ +2.4% tháng này</Typography>
              </Box>
            </Stack>
            {/* Mini bar chart */}
            <Stack direction="row" alignItems="flex-end" spacing={0.5} mt={2} height={28}>
              {[40, 65, 45, 80, 55, 87, 72].map((h, i) => (
                <Box key={i} sx={{
                  flex: 1, borderRadius: "3px 3px 0 0",
                  background: i === 5 ? T.success : `${T.success}30`,
                  height: `${h}%`, transition: "height 0.3s",
                }} />
              ))}
            </Stack>
          </Widget>

          <Widget top="62%" right="6%" delay="2.5s">
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textMuted, letterSpacing: "1.5px", textTransform: "uppercase" }}>
                Thời gian xử lý TB
              </Typography>
              <Box sx={{ px: 1, py: 0.25, borderRadius: "4px", bgcolor: T.primaryDim, border: `1px solid ${T.primary}30` }}>
                <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.55rem", color: T.primary }}>LIVE</Typography>
              </Box>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2}>
              <DonutChart percent={65} color={T.primary} />
              <Box>
                <Typography sx={{ fontFamily: T.fontDisplay, color: "#fff", fontWeight: 700, fontSize: "1.4rem", lineHeight: 1 }}>10.5h</Typography>
                <Typography sx={{ color: T.primary, fontSize: "0.72rem", fontFamily: T.fontMono, mt: 0.5 }}>↘ Tối ưu 15%</Typography>
              </Box>
            </Stack>
          </Widget>

          {/* Scan line effect on left panel */}
          <Box sx={{
            position: "absolute", left: 0, right: 0, height: "2px", zIndex: 3,
            background: `linear-gradient(90deg, transparent, ${T.primary}60, transparent)`,
            animation: `${scan} 6s ease-in-out infinite`,
            animationDelay: "1s",
          }} />
        </Box>

        {/* ====== RIGHT PANEL — FORM ====== */}
        <Box sx={{
          width: { xs: "100%", md: "540px" },
          flexShrink: 0,
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          position: "relative", zIndex: 10,
          px: { xs: 3, sm: 5 },
          py: 6,
          background: `linear-gradient(180deg, ${T.surface}00 0%, ${T.surface}ff 20%)`,
          borderLeft: `1px solid ${T.border}`,
        }}>

          {/* ── Toggle ── */}
          <Box sx={{
            position: "absolute", top: 28, right: 32,
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${T.border}`,
            borderRadius: "50px", padding: "4px", gap: 0,
          }}>
            {[
              { label: "Đăng nhập", active: isLogin,  onClick: () => !isLogin && toggleMode() },
              { label: "Đăng ký",   active: !isLogin, onClick: () => isLogin && toggleMode() },
            ].map(({ label, active, onClick }) => (
              <Box key={label} onClick={onClick} sx={{
                position: "relative", cursor: "pointer",
                px: "20px", py: "7px", borderRadius: "40px",
                fontSize: "0.72rem", fontFamily: T.fontDisplay,
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.8px", textTransform: "uppercase",
                color: active ? "#fff" : T.textMuted,
                background: active
                  ? `linear-gradient(135deg, ${T.primary} 0%, #0d9488 100%)`
                  : "transparent",
                boxShadow: active ? `0 2px 16px ${T.primaryGlow}` : "none",
                transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                "&:hover": { color: active ? "#fff" : T.textPrimary },
              }}>
                {label}
              </Box>
            ))}
          </Box>

          {/* ── Form ── */}
          <Box key={animKey} sx={{ width: "100%", maxWidth: 400, animation: `${fadeUp} 0.45s ease-out` }}>

            {/* Header */}
            <Box sx={{ mb: 5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 4, height: 32, borderRadius: "2px",
                  background: `linear-gradient(180deg, ${T.primary}, ${T.accent})`,
                  boxShadow: `0 0 12px ${T.primaryGlow}`,
                }} />
                <Typography sx={{
                  fontFamily: T.fontDisplay, fontWeight: 800, fontSize: "1.65rem",
                  color: T.textPrimary, lineHeight: 1,
                }}>
                  {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}
                </Typography>
              </Box>
              <Typography sx={{ color: T.textMuted, fontFamily: T.fontBody, fontSize: "0.875rem", pl: "20px" }}>
                {isLogin
                  ? "Nhập thông tin để truy cập hệ thống báo cáo."
                  : "Trải nghiệm miễn phí nền tảng phân tích số 1."}
              </Typography>

              {apiError && (
                <Box sx={{
                  mt: 2.5, p: "12px 16px", borderRadius: "10px",
                  bgcolor: T.errorDim, border: `1px solid ${T.error}30`,
                  display: "flex", alignItems: "center", gap: 1,
                }}>
                  <ErrorOutline sx={{ color: T.error, fontSize: 16 }} />
                  <Typography sx={{ color: T.error, fontSize: "0.8rem", fontFamily: T.fontBody }}>
                    {apiError}
                  </Typography>
                </Box>
              )}

              {successMsg && (
                <Box sx={{
                  mt: 2.5, p: "12px 16px", borderRadius: "10px",
                  bgcolor: T.successDim, border: `1px solid ${T.success}30`,
                  display: "flex", alignItems: "center", gap: 1,
                }}>
                  <CheckCircle sx={{ color: T.success, fontSize: 16 }} />
                  <Typography sx={{ color: T.success, fontSize: "0.8rem", fontFamily: T.fontBody }}>
                    {successMsg}
                  </Typography>
                </Box>
              )}
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>

              {/* Username (Luôn hiện) */}
              <FieldWrap error={errors.username}>
                <StyledInput fullWidth placeholder="Tên đăng nhập" hasError={!!errors.username}
                  value={values.username} onChange={handleChange("username")} onBlur={handleBlur("username")}
                  InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline /></InputAdornment> }}
                />
                {errors.username && <ErrMsg msg={errors.username} />}
              </FieldWrap>

              {/* Họ và tên (Chỉ khi Đăng ký) */}
              {!isLogin && (
                <FieldWrap error={errors.fullName}>
                  <StyledInput fullWidth placeholder="Họ và tên" hasError={!!errors.fullName}
                    value={values.fullName} onChange={handleChange("fullName")} onBlur={handleBlur("fullName")}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline /></InputAdornment> }}
                  />
                  {errors.fullName && <ErrMsg msg={errors.fullName} />}
                </FieldWrap>
              )}

              {/* Email (Chỉ khi Đăng ký) */}
              {!isLogin && (
                <FieldWrap error={errors.email}>
                  <StyledInput fullWidth placeholder="Email liên hệ" hasError={!!errors.email}
                    value={values.email} onChange={handleChange("email")} onBlur={handleBlur("email")}
                    InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> }}
                  />
                  {errors.email && <ErrMsg msg={errors.email} />}
                </FieldWrap>
              )}

              {/* Password */}
              <FieldWrap error={errors.password}>
                <StyledInput fullWidth placeholder="Mật khẩu" type={showPass ? "text" : "password"}
                  hasError={!!errors.password} value={values.password}
                  onChange={handleChange("password")} onBlur={handleBlur("password")}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPass(v => !v)} edge="end" sx={{ color: T.textMuted, mr: -0.5 }}>
                          {showPass ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                {/* Password Strength — register only */}
                {!isLogin && values.password.length > 0 && (
                  <Box sx={{ mt: 1.5, mb: 1 }}>
                    {/* Strength bar */}
                    <Stack direction="row" spacing={0.5} mb={1}>
                      {[1,2,3,4,5].map(i => (
                        <Box key={i} sx={{
                          flex: 1, height: "3px", borderRadius: "2px",
                          bgcolor: i <= passStrength ? strengthColors[passStrength] : T.border,
                          transition: "background-color 0.3s ease",
                          boxShadow: i <= passStrength ? `0 0 6px ${strengthColors[passStrength]}80` : "none",
                        }} />
                      ))}
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: T.textMuted, fontSize: "0.7rem", fontFamily: T.fontMono }}>Độ mạnh mật khẩu</Typography>
                      <Typography sx={{ color: strengthColors[passStrength], fontSize: "0.7rem", fontFamily: T.fontMono, fontWeight: 600 }}>
                        {strengthLabels[passStrength]}
                      </Typography>
                    </Stack>

                    {/* Criteria list — compact */}
                    <Box sx={{ mt: 1.5, display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
                      {CRITERIA.map(c => {
                        const met = c.test(values.password);
                        return (
                          <Stack key={c.id} direction="row" alignItems="center" spacing={0.5}>
                            <Box sx={{
                              width: 6, height: 6, borderRadius: "50%",
                              bgcolor: met ? T.primary : T.border,
                              transition: "background-color 0.2s",
                              boxShadow: met ? `0 0 6px ${T.primary}` : "none",
                            }} />
                            <Typography sx={{
                              fontSize: "0.68rem", fontFamily: T.fontBody,
                              color: met ? T.textSecond : T.textMuted,
                              transition: "color 0.2s",
                            }}>
                              {c.label}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {isLogin && errors.password && <ErrMsg msg={errors.password} />}
              </FieldWrap>

              {/* Confirm password */}
              {!isLogin && (
                <FieldWrap error={errors.confirmPassword}>
                  <StyledInput fullWidth placeholder="Xác nhận mật khẩu" type={showConfirmPass ? "text" : "password"}
                    hasError={!!errors.confirmPassword} value={values.confirmPassword}
                    onChange={handleChange("confirmPassword")} onBlur={handleBlur("confirmPassword")}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LockOutlined /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirmPass(v => !v)} edge="end" sx={{ color: T.textMuted, mr: -0.5 }}>
                            {showConfirmPass ? <VisibilityOff sx={{ fontSize: 18 }} /> : <Visibility sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                  {errors.confirmPassword && <ErrMsg msg={errors.confirmPassword} />}
                </FieldWrap>
              )}

              {/* Remember / Forgot — login only */}
              {isLogin && (
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <FormControlLabel
                    control={<Checkbox size="small" sx={{
                      color: T.border, p: 0.5,
                      "&.Mui-checked": { color: T.primary },
                    }} />}
                    label={<Typography sx={{ color: T.textMuted, fontSize: "0.82rem", fontFamily: T.fontBody }}>Ghi nhớ đăng nhập</Typography>}
                  />
                  <Typography sx={{
                    color: T.primary, cursor: "pointer", fontSize: "0.82rem",
                    fontFamily: T.fontBody, fontWeight: 600,
                    "&:hover": { textDecoration: "underline" },
                  }}>
                    Quên mật khẩu?
                  </Typography>
                </Stack>
              )}

              {/* Submit button */}
              <Box sx={{
                mt: 3, position: "relative", borderRadius: "12px",
                background: loading
                  ? T.border
                  : `linear-gradient(135deg, ${T.primary} 0%, #0d9488 50%, ${T.accent} 100%)`,
                backgroundSize: "200% auto",
                boxShadow: loading ? "none" : `0 8px 32px ${T.primaryGlow}`,
                transition: "all 0.3s ease",
                "&:hover": {
                  backgroundPosition: "right center",
                  boxShadow: loading ? "none" : `0 12px 40px ${T.primaryGlow}`,
                  transform: loading ? "none" : "translateY(-1px)",
                },
              }}>
                <Button fullWidth type="submit" disabled={loading} sx={{
                  py: "13px", borderRadius: "12px",
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.9rem",
                  textTransform: "none", letterSpacing: "0.3px",
                  color: loading ? T.textMuted : "#fff",
                  background: "transparent",
                  "&:hover": { background: "transparent" },
                  "&.Mui-disabled": { background: "transparent" },
                }}
                  endIcon={!loading && <ArrowForward sx={{ fontSize: 18 }} />}
                >
                  {loading
                    ? <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <LoadingDots />
                        Đang xử lý…
                      </Box>
                    : isLogin ? "Đăng nhập Dashboard" : "Tạo tài khoản ngay"
                  }
                </Button>
              </Box>

              {/* Divider */}
              <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 3, mb: 3 }}>
                <Box sx={{ flex: 1, height: "1px", bgcolor: T.border }} />
                <Typography sx={{ color: T.textMuted, fontSize: "0.72rem", fontFamily: T.fontMono, letterSpacing: "1px" }}>HOẶC</Typography>
                <Box sx={{ flex: 1, height: "1px", bgcolor: T.border }} />
              </Stack>

              {/* Social logins */}
              <Stack direction="row" spacing={1.5}>
                {[
                  { icon: "G", label: "Google", color: "#ea4335" },
                  { icon: "M", label: "Microsoft", color: "#00a4ef" },
                  { icon: "GH", label: "GitHub", color: "#c9d1d9" },
                ].map(({ icon, label, color }) => (
                  <Box key={label} sx={{
                    flex: 1, py: "10px", borderRadius: "10px", cursor: "pointer",
                    border: `1px solid ${T.border}`,
                    background: "rgba(255,255,255,0.02)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 1, transition: "all 0.2s",
                    "&:hover": {
                      borderColor: color + "50",
                      background: color + "10",
                      transform: "translateY(-2px)",
                    },
                  }}>
                    <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.7rem", color, fontWeight: 700 }}>{icon}</Typography>
                    <Typography sx={{ fontFamily: T.fontBody, fontSize: "0.75rem", color: T.textMuted }}>{label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
};

/* =========================================================
   SMALL HELPERS
========================================================= */
const FieldWrap = ({ children, error }) => (
  <Box sx={{ mb: error ? 0.5 : 2 }}>{children}</Box>
);

const ErrMsg = ({ msg }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, mb: 1.5 }}>
    <ErrorOutline sx={{ fontSize: 13, color: T.error }} />
    <Typography sx={{ color: T.error, fontSize: "0.73rem", fontFamily: T.fontBody }}>{msg}</Typography>
  </Box>
);

const LoadingDots = () => (
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

export default AuthPage;