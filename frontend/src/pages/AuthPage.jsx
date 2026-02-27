// FILE: src/pages/AuthPage.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Toàn bộ CSS/style đã được chuyển sang:
//   src/theme/designSystem.js  — tokens, keyframes, shared components
//   src/styles/global.css      — CSS thuần, Google Fonts, resets
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import {
  Box, Typography, Stack, Button,
  IconButton, InputAdornment, Checkbox, FormControlLabel, CssBaseline,
} from "@mui/material";
import {
  Visibility, VisibilityOff, EmailOutlined, LockOutlined,
  PersonOutline, ArrowForward, AssessmentOutlined, ErrorOutline,
} from "@mui/icons-material";

// ── Shared design system ──────────────────────────────────────────────────────
import {
  T,
  fadeUp, shimmer, scan, floatY, pulse,
  Noise, AmbientOrbs, GridOverlay,
  StyledInput, FieldWrap, ErrMsg, LoadingDots,
} from "../theme/designSystem.jsx";

// ── API & Router ──────────────────────────────────────────────────────────────
import { signupAPI, loginAPI } from "../services/api";
import { useNavigate } from "react-router-dom";

/* =========================================================
   PAGE-LOCAL: DonutChart
   (Chỉ dùng ở AuthPage nên giữ tại đây, không đưa vào designSystem)
========================================================= */
const DonutChart = ({ percent, color, size = 58 }) => {
  const r    = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <Box sx={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: "stroke-dasharray 1s ease" }} />
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
   PAGE-LOCAL: Floating Widget
========================================================= */
const Widget = ({ top, left, right, bottom, delay, children }) => (
  <Box sx={{
    position: "absolute", top, left, right, bottom,
    background: "rgba(8, 14, 26, 0.75)",
    backdropFilter: "blur(20px) saturate(150%)",
    WebkitBackdropFilter: "blur(20px) saturate(150%)",
    border: `1px solid ${T.border}`,
    borderRadius: T.radiusLg, padding: "20px 22px", width: 270, zIndex: 2,
    boxShadow: "0 30px 60px -15px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
    animation: `${floatY} 8s ease-in-out infinite`,
    animationDelay: delay || "0s",
  }}>
    {children}
  </Box>
);

/* =========================================================
   VALIDATION CONSTANTS
========================================================= */
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRITERIA = [
  { id: 1, label: "8–72 ký tự",             test: p => p.length >= 8 && p.length <= 72 },
  { id: 2, label: "Chữ hoa (A–Z)",          test: p => /[A-Z]/.test(p) },
  { id: 3, label: "Chữ thường (a–z)",       test: p => /[a-z]/.test(p) },
  { id: 4, label: "Chữ số (0–9)",           test: p => /[0-9]/.test(p) },
  { id: 5, label: "Ký tự đặc biệt (!@#…)", test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];
const STRENGTH_COLORS = ["#334155", T.error, "#f97316", T.gold, T.primary, T.success];
const STRENGTH_LABELS = ["", "Rất yếu", "Yếu", "Trung bình", "Tốt", "Mạnh"];

/* =========================================================
   MAIN COMPONENT
========================================================= */
const AuthPage = () => {
  const navigate = useNavigate();

  const [isLogin, setIsLogin]           = useState(true);
  const [loading, setLoading]           = useState(false);
  const [apiError, setApiError]         = useState("");
  const [showPass, setShowPass]         = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [animKey, setAnimKey]           = useState(0);
  const [values, setValues]             = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors]             = useState({});
  const [touched, setTouched]           = useState({});

  const passStrength = CRITERIA.filter(c => c.test(values.password)).length;

  /* ── Handlers ── */
  const toggleMode = () => {
    setIsLogin(v => !v);
    setValues({ name: "", email: "", password: "", confirmPassword: "" });
    setErrors({}); setTouched({}); setApiError("");
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
    const { email, password, confirmPassword, name } = values;
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
    if (field === "name" && !isLogin) {
      if (!name.trim()) errs.name = "Vui lòng nhập Họ và Tên.";
      else delete errs.name;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = e => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    let submitErrors = {};
    if (!values.email)                    submitErrors.email = "Vui lòng nhập email.";
    else if (!REGEX_EMAIL.test(values.email)) submitErrors.email = "Định dạng email không hợp lệ.";
    if (!values.password)                 submitErrors.password = "Vui lòng nhập mật khẩu.";
    else if (!isLogin && !CRITERIA.every(c => c.test(values.password))) submitErrors.password = "Mật khẩu chưa đủ mạnh.";
    if (!isLogin) {
      if (!values.name.trim()) submitErrors.name = "Vui lòng nhập tên Họ và Tên.";
      if (!values.confirmPassword) submitErrors.confirmPassword = "Vui lòng xác nhận mật khẩu.";
      else if (values.confirmPassword !== values.password) submitErrors.confirmPassword = "Mật khẩu không khớp.";
    }
    setErrors(submitErrors);
    if (Object.keys(submitErrors).length > 0) return;

    setLoading(true);
    setApiError("");
    const payload = {
      username:  values.email.split("@")[0],
      email:     values.email,
      password:  values.password,
      full_name: values.name || values.email.split("@")[0],
    };

    if (isLogin) {
      loginAPI({ username: payload.username, password: payload.password })
        .then(res => { localStorage.setItem("token", res.access_token); navigate("/"); })
        .catch(err => setApiError(err.response?.data?.detail || "Đăng nhập thất bại. Vui lòng kiểm tra lại."))
        .finally(() => setLoading(false));
    } else {
      signupAPI(payload)
        .then(() => { alert("Đăng ký thành công! Hãy đăng nhập nhé."); setIsLogin(true); setValues({ ...values, password: "", confirmPassword: "" }); })
        .catch(err => setApiError(err.response?.data?.detail || "Đăng ký thất bại. Email hoặc Username có thể đã tồn tại."))
        .finally(() => setLoading(false));
    }
  };

  /* ── Render ── */
  return (
    <>
      <CssBaseline />
      <Box sx={{
        display: "flex", width: "100%", minHeight: "100vh",
        backgroundColor: T.bg, fontFamily: T.fontBody,
        position: "relative", overflow: "hidden",
      }}>
        {/* ── Background layers (from designSystem) ── */}
        <Noise />
        <AmbientOrbs />
        <GridOverlay />

        {/* ══════════════════════════════════════════
            LEFT PANEL — Visual / Marketing
        ══════════════════════════════════════════ */}
        <Box sx={{
          flex: 1, position: "relative",
          display: { xs: "none", md: "flex" },
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
            <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem", color: T.textPrimary, letterSpacing: "0.04em" }}>
              ANALYTICS<Box component="span" sx={{ color: T.primary }}>PRO</Box>
            </Typography>
          </Box>

          {/* Hero text */}
          <Box sx={{ position: "relative", zIndex: 2, textAlign: "center", px: 6, mb: 12 }}>
            <Typography sx={{
              fontFamily: T.fontDisplay, fontWeight: 800,
              fontSize: "clamp(1.8rem, 3vw, 2.6rem)",
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

          {/* Widget 1 — Completion Rate */}
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

          {/* Widget 2 — Processing Time */}
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

          {/* Scan line */}
          <Box sx={{
            position: "absolute", left: 0, right: 0, height: "2px", zIndex: 3,
            background: `linear-gradient(90deg, transparent, ${T.primary}60, transparent)`,
            animation: `${scan} 6s ease-in-out infinite`,
            animationDelay: "1s",
          }} />
        </Box>

        {/* ══════════════════════════════════════════
            RIGHT PANEL — Auth Form
        ══════════════════════════════════════════ */}
        <Box sx={{
          width: { xs: "100%", md: "540px" }, flexShrink: 0,
          display: "flex", flexDirection: "column",
          justifyContent: "center", alignItems: "center",
          position: "relative", zIndex: 10,
          px: { xs: 3, sm: 5 }, py: 6,
          background: `linear-gradient(180deg, ${T.surface}00 0%, ${T.surface}ff 20%)`,
          borderLeft: `1px solid ${T.border}`,
        }}>

          {/* ── Mode Toggle ── */}
          <Box sx={{
            position: "absolute", top: 28, right: 32,
            display: "flex", alignItems: "center",
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(16px)",
            border: `1px solid ${T.border}`,
            borderRadius: "50px", padding: "4px",
          }}>
            {[
              { label: "Đăng nhập", active: isLogin,  onClick: () => !isLogin && toggleMode() },
              { label: "Đăng ký",   active: !isLogin, onClick: () => isLogin && toggleMode() },
            ].map(({ label, active, onClick }) => (
              <Box key={label} onClick={onClick} sx={{
                cursor: "pointer", px: "20px", py: "7px", borderRadius: "40px",
                fontSize: "0.72rem", fontFamily: T.fontDisplay,
                fontWeight: active ? 700 : 500,
                letterSpacing: "0.8px", textTransform: "uppercase",
                color: active ? "#fff" : T.textMuted,
                background: active ? `linear-gradient(135deg, ${T.primary} 0%, #0d9488 100%)` : "transparent",
                boxShadow: active ? `0 2px 16px ${T.primaryGlow}` : "none",
                transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)",
                "&:hover": { color: active ? "#fff" : T.textPrimary },
              }}>
                {label}
              </Box>
            ))}
          </Box>

          {/* ── Form Wrapper ── */}
          <Box key={animKey} sx={{ width: "100%", maxWidth: 400, animation: `${fadeUp} 0.45s ease-out` }}>

            {/* Header */}
            <Box sx={{ mb: 5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
                <Box sx={{
                  width: 4, height: 32, borderRadius: "2px",
                  background: `linear-gradient(180deg, ${T.primary}, ${T.accent})`,
                  boxShadow: `0 0 12px ${T.primaryGlow}`,
                }} />
                <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 800, fontSize: "1.65rem", color: T.textPrimary, lineHeight: 1 }}>
                  {isLogin ? "Chào mừng trở lại" : "Tạo tài khoản"}
                </Typography>
              </Box>
              <Typography sx={{ color: T.textMuted, fontFamily: T.fontBody, fontSize: "0.875rem", pl: "20px" }}>
                {isLogin ? "Nhập thông tin để truy cập hệ thống báo cáo." : "Trải nghiệm miễn phí nền tảng phân tích số 1."}
              </Typography>

              {apiError && (
                <Box sx={{
                  mt: 2.5, p: "12px 16px", borderRadius: "10px",
                  bgcolor: T.errorDim, border: `1px solid ${T.error}30`,
                  display: "flex", alignItems: "center", gap: 1,
                }}>
                  <ErrorOutline sx={{ color: T.error, fontSize: 16 }} />
                  <Typography sx={{ color: T.error, fontSize: "0.8rem", fontFamily: T.fontBody }}>{apiError}</Typography>
                </Box>
              )}
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>

              {/* Họ và Tên — Register only */}
              {!isLogin && (
                <FieldWrap error={errors.name}>
                  <StyledInput fullWidth placeholder="Họ và Tên" hasError={!!errors.name}
                    value={values.name} onChange={handleChange("name")} onBlur={handleBlur("name")}
                    InputProps={{ startAdornment: <InputAdornment position="start"><PersonOutline /></InputAdornment> }}
                  />
                  {errors.name && <ErrMsg msg={errors.name} />}
                </FieldWrap>
              )}

              {/* Email */}
              <FieldWrap error={errors.email}>
                <StyledInput fullWidth placeholder="Email quản trị" hasError={!!errors.email}
                  value={values.email} onChange={handleChange("email")} onBlur={handleBlur("email")}
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailOutlined /></InputAdornment> }}
                />
                {errors.email && <ErrMsg msg={errors.email} />}
              </FieldWrap>

              {/* Password */}
              <FieldWrap error={errors.password}>
                <StyledInput fullWidth placeholder="Mật khẩu"
                  type={showPass ? "text" : "password"}
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

                {/* Password strength — Register only */}
                {!isLogin && values.password.length > 0 && (
                  <Box sx={{ mt: 1.5, mb: 1 }}>
                    <Stack direction="row" spacing={0.5} mb={1}>
                      {[1,2,3,4,5].map(i => (
                        <Box key={i} sx={{
                          flex: 1, height: "3px", borderRadius: "2px",
                          bgcolor: i <= passStrength ? STRENGTH_COLORS[passStrength] : T.border,
                          transition: "background-color 0.3s ease",
                          boxShadow: i <= passStrength ? `0 0 6px ${STRENGTH_COLORS[passStrength]}80` : "none",
                        }} />
                      ))}
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ color: T.textMuted, fontSize: "0.7rem", fontFamily: T.fontMono }}>Độ mạnh mật khẩu</Typography>
                      <Typography sx={{ color: STRENGTH_COLORS[passStrength], fontSize: "0.7rem", fontFamily: T.fontMono, fontWeight: 600 }}>
                        {STRENGTH_LABELS[passStrength]}
                      </Typography>
                    </Stack>
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
                            <Typography sx={{ fontSize: "0.68rem", fontFamily: T.fontBody, color: met ? T.textSecond : T.textMuted, transition: "color 0.2s" }}>
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

              {/* Confirm Password — Register only */}
              {!isLogin && (
                <FieldWrap error={errors.confirmPassword}>
                  <StyledInput fullWidth placeholder="Xác nhận mật khẩu"
                    type={showConfirmPass ? "text" : "password"}
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

              {/* Remember / Forgot — Login only */}
              {isLogin && (
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <FormControlLabel
                    control={<Checkbox size="small" sx={{ color: T.border, p: 0.5, "&.Mui-checked": { color: T.primary } }} />}
                    label={<Typography sx={{ color: T.textMuted, fontSize: "0.82rem", fontFamily: T.fontBody }}>Ghi nhớ đăng nhập</Typography>}
                  />
                  <Typography sx={{ color: T.primary, cursor: "pointer", fontSize: "0.82rem", fontFamily: T.fontBody, fontWeight: 600, "&:hover": { textDecoration: "underline" } }}>
                    Quên mật khẩu?
                  </Typography>
                </Stack>
              )}

              {/* Submit */}
              <Box sx={{
                mt: 3, position: "relative", borderRadius: T.radiusMd,
                background: loading ? T.border : `linear-gradient(135deg, ${T.primary} 0%, #0d9488 50%, ${T.accent} 100%)`,
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
                  py: "13px", borderRadius: T.radiusMd,
                  fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.9rem",
                  textTransform: "none", letterSpacing: "0.3px",
                  color: loading ? T.textMuted : "#fff",
                  background: "transparent",
                  "&:hover": { background: "transparent" },
                  "&.Mui-disabled": { background: "transparent" },
                }} endIcon={!loading && <ArrowForward sx={{ fontSize: 18 }} />}>
                  {loading
                    ? <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><LoadingDots />Đang xử lý…</Box>
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
                  { icon: "G",  label: "Google",    color: "#ea4335" },
                  { icon: "M",  label: "Microsoft", color: "#00a4ef" },
                  { icon: "GH", label: "GitHub",    color: "#c9d1d9" },
                ].map(({ icon, label, color }) => (
                  <Box key={label} sx={{
                    flex: 1, py: "10px", borderRadius: "10px", cursor: "pointer",
                    border: `1px solid ${T.border}`,
                    background: "rgba(255,255,255,0.02)",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 1,
                    transition: "all 0.2s",
                    "&:hover": { borderColor: color + "50", background: color + "10", transform: "translateY(-2px)" },
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

export default AuthPage;