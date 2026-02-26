// FILE: frontend/src/pages/BrandLobby.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, Typography, Box, CircularProgress, Alert, Grid,
  Dialog, DialogTitle, DialogContent, TextField, DialogActions,
  Button, IconButton, Tooltip
} from '@mui/material';
import { getAllBrands, createBrand, deleteBrand, updateBrand, cloneBrand } from '../services/api';
import BrandCard from '../components/brand/BrandCard';
import CreateBrandCard from '../components/brand/CreateBrandCard';
import LogoutIcon from '@mui/icons-material/Logout';
import { keyframes } from '@mui/material/styles';

/* =========================================================
   DESIGN TOKENS — Luxury Dark Tech (shared with AuthPage)
========================================================= */
const T = {
  bg:          "#04080f",
  surface:     "#080e1a",
  panel:       "#0a1120",
  border:      "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  primary:     "#2dd4bf",
  primaryDim:  "rgba(45, 212, 191, 0.12)",
  primaryGlow: "rgba(45, 212, 191, 0.30)",
  accent:      "#818cf8",
  accentDim:   "rgba(129, 140, 248, 0.12)",
  gold:        "#f59e0b",
  textPrimary: "#f1f5f9",
  textSecond:  "#94a3b8",
  textMuted:   "#475569",
  error:       "#f87171",
  errorDim:    "rgba(248, 113, 113, 0.1)",
  success:     "#34d399",
  fontDisplay: "'Sora', sans-serif",
  fontMono:    "'JetBrains Mono', monospace",
  fontBody:    "'DM Sans', sans-serif",
};

/* =========================================================
   KEYFRAMES
========================================================= */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(24px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const orbFloat = keyframes`
  0%   { transform: translate(0, 0) scale(1); }
  25%  { transform: translate(40px, -25px) scale(1.04); }
  50%  { transform: translate(-25px, 40px) scale(0.96); }
  75%  { transform: translate(25px, 15px) scale(1.02); }
  100% { transform: translate(0, 0) scale(1); }
`;
const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position: 200% center; }
`;
const scan = keyframes`
  0%   { top: -2px; opacity: 0; }
  5%   { opacity: 0.6; }
  95%  { opacity: 0.6; }
  100% { top: 100%; opacity: 0; }
`;
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
`;
const spinnerAnim = keyframes`
  to { transform: rotate(360deg); }
`;

/* =========================================================
   FONT INJECTION
========================================================= */
const FontStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; }
    ::selection { background: ${T.primaryDim}; color: ${T.primary}; }
  `}</style>
);

/* =========================================================
   BACKGROUND LAYERS
========================================================= */
const Noise = () => (
  <Box sx={{
    position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.03,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    backgroundSize: "128px 128px",
  }} />
);

const AmbientOrbs = () => (
  <Box sx={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
    {[
      { size: 700, top: "-20%", left: "-10%",  color: T.primary, delay: "0s",  dur: "20s" },
      { size: 600, bottom: "-20%", right: "-8%", color: T.accent,  delay: "7s",  dur: "25s" },
      { size: 350, top: "35%",  left: "38%",  color: T.gold,    delay: "3.5s", dur: "17s" },
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

const GridOverlay = () => (
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

/* =========================================================
   CUSTOM LOADING SPINNER
========================================================= */
const LoadingScreen = () => (
  <Box sx={{
    display: "flex", flexDirection: "column",
    justifyContent: "center", alignItems: "center",
    height: "100vh", backgroundColor: T.bg, gap: 3,
    fontFamily: T.fontBody,
  }}>
    <FontStyle />
    <Noise />
    <AmbientOrbs />
    <Box sx={{
      width: 44, height: 44, borderRadius: "50%",
      border: `2px solid ${T.border}`,
      borderTopColor: T.primary,
      animation: `${spinnerAnim} 0.8s linear infinite`,
    }} />
    <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.72rem", color: T.textMuted, letterSpacing: "2px", textTransform: "uppercase" }}>
      Đang tải dữ liệu…
    </Typography>
  </Box>
);

/* =========================================================
   STYLED DIALOG BASE
========================================================= */
const dialogPaperSx = {
  borderRadius: "20px",
  backgroundColor: "rgba(8, 14, 26, 0.85)",
  backdropFilter: "blur(24px) saturate(150%)",
  WebkitBackdropFilter: "blur(24px)",
  border: `1px solid ${T.border}`,
  boxShadow: "0 40px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)",
  fontFamily: T.fontBody,
  overflow: "visible",
};

/* =========================================================
   MAIN COMPONENT
========================================================= */
function BrandLobby() {
  const [brands, setBrands]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const navigate                    = useNavigate();
  const [dialogs, setDialogs]       = useState({ rename: false, delete: false });
  const [selectedBrand, setSelected] = useState(null);
  const [newName, setNewName]       = useState('');
  const [renameError, setRenameError] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const fetchBrands = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getAllBrands();
      setBrands(data);
    } catch {
      setError('Không thể tải danh sách Brand từ server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const handleBrandClick    = (slug) => navigate(`/dashboard/${slug}`);
  const handleBrandCreated  = async (name) => {
    if (!name) return;
    try { setError(null); await createBrand(name); fetchBrands(); }
    catch (err) { throw err; }
  };

  const openRenameDialog = (brand) => {
    setSelected(brand); setNewName(brand.name); setRenameError('');
    setDialogs({ ...dialogs, rename: true });
  };
  const openDeleteDialog = (brand) => {
    setSelected(brand); setDialogs({ ...dialogs, delete: true });
  };
  const closeDialogs = () => {
    setDialogs({ rename: false, delete: false }); setSelected(null); setRenameError('');
  };

  const handleRenameSubmit = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !selectedBrand) return;
    try { await updateBrand(selectedBrand.id, trimmed); fetchBrands(); closeDialogs(); }
    catch (err) { setRenameError(err.response?.data?.detail || 'Lỗi không xác định.'); }
  };
  const handleCloneSubmit = async (brandId) => {
    try { setError(null); await cloneBrand(brandId); fetchBrands(); }
    catch (err) { setError(err.response?.data?.detail || 'Lỗi khi nhân bản.'); }
  };
  const handleDeleteSubmit = async () => {
    if (!selectedBrand) return;
    try { setError(null); await deleteBrand(selectedBrand.id); fetchBrands(); closeDialogs(); }
    catch (err) { setError(err.response?.data?.detail || 'Lỗi khi xóa.'); }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <FontStyle />
      <Box sx={{ minHeight: "100vh", backgroundColor: T.bg, position: "relative", fontFamily: T.fontBody }}>
        <Noise />
        <AmbientOrbs />
        <GridOverlay />

        {/* Scan line */}
        <Box sx={{
          position: "fixed", left: 0, right: 0, height: "1px", zIndex: 5, pointerEvents: "none",
          background: `linear-gradient(90deg, transparent 0%, ${T.primary}50 50%, transparent 100%)`,
          animation: `${scan} 8s ease-in-out infinite`,
        }} />

        {/* ── HEADER ── */}
        <Box sx={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          px: "40px", py: "18px",
          background: "rgba(4, 8, 15, 0.7)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${T.border}`,
        }}>
          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{
              width: 34, height: 34, borderRadius: "10px",
              background: `linear-gradient(135deg, ${T.primaryDim}, ${T.accentDim})`,
              border: `1px solid ${T.primary}40`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {/* Icon inline SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="12" width="4" height="9" rx="1" fill={T.primary} opacity="0.7"/>
                <rect x="10" y="7"  width="4" height="14" rx="1" fill={T.primary} opacity="0.9"/>
                <rect x="17" y="3"  width="4" height="18" rx="1" fill={T.primary}/>
              </svg>
            </Box>
            <Typography sx={{
              fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.95rem",
              color: T.textPrimary, letterSpacing: "0.04em",
            }}>
              ANALYTICS<Box component="span" sx={{ color: T.primary }}>PRO</Box>
            </Typography>
          </Box>

          {/* Right side */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            {/* Live indicator */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
              borderRadius: "20px", border: `1px solid ${T.success}30`, bgcolor: `${T.success}10` }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: T.success,
                animation: `${pulse} 2s ease-in-out infinite`, boxShadow: `0 0 6px ${T.success}` }} />
              <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.success, letterSpacing: "1px" }}>
                LIVE
              </Typography>
            </Box>

            {/* Brand count badge */}
            <Box sx={{ px: 1.5, py: 0.75, borderRadius: "20px", border: `1px solid ${T.border}`,
              bgcolor: "rgba(255,255,255,0.02)" }}>
              <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textMuted, letterSpacing: "1px" }}>
                {brands.length} THƯƠNG HIỆU
              </Typography>
            </Box>

            {/* Logout */}
            <Tooltip title="Đăng xuất" placement="bottom">
              <IconButton onClick={handleLogout} sx={{
                width: 36, height: 36, borderRadius: "10px",
                border: `1px solid rgba(248, 113, 113, 0.2)`,
                bgcolor: "rgba(248, 113, 113, 0.06)",
                color: T.error,
                transition: "all 0.2s ease",
                "&:hover": {
                  bgcolor: "rgba(248, 113, 113, 0.15)",
                  borderColor: `${T.error}50`,
                  transform: "translateY(-1px)",
                  boxShadow: `0 4px 16px rgba(248, 113, 113, 0.2)`,
                },
              }}>
                <LogoutIcon sx={{ fontSize: 17 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* ── MAIN CONTENT ── */}
        <Box sx={{ position: "relative", zIndex: 1, pt: "96px", pb: "80px", px: { xs: 3, sm: 5, md: 8, lg: 12 } }}>

          {/* Page header */}
          <Box sx={{
            textAlign: "center", mb: 8,
            animation: `${fadeUp} 0.6s ease-out`,
          }}>
            {/* Eyebrow label */}
            <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1, mb: 2,
              px: 2, py: 0.75, borderRadius: "20px",
              border: `1px solid ${T.primary}30`, bgcolor: T.primaryDim }}>
              <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: T.primary,
                boxShadow: `0 0 8px ${T.primary}`, animation: `${pulse} 2s infinite` }} />
              <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.62rem", color: T.primary, letterSpacing: "2px" }}>
                BRAND MANAGEMENT
              </Typography>
            </Box>

            <Typography sx={{
              fontFamily: T.fontDisplay, fontWeight: 800,
              fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
              color: T.textPrimary, lineHeight: 1.15, mb: 1.5,
            }}>
              Business{" "}
              <Box component="span" sx={{
                background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent} 100%)`,
                backgroundClip: "text", WebkitBackgroundClip: "text", color: "transparent",
                backgroundSize: "200% auto",
                animation: `${shimmer} 4s linear infinite`,
              }}>
                Analytics
              </Box>
            </Typography>

            <Typography sx={{
              fontFamily: T.fontBody, color: T.textMuted, fontSize: "0.95rem",
              maxWidth: 500, mx: "auto", lineHeight: 1.7,
            }}>
              Quản lý toàn bộ thương hiệu trong một nơi. Phân tích, theo dõi và tối ưu hóa hiệu suất kinh doanh.
            </Typography>
          </Box>

          {/* Error alert */}
          {error && (
            <Box sx={{
              mb: 4, p: "14px 18px", borderRadius: "12px", maxWidth: 600, mx: "auto",
              bgcolor: T.errorDim, border: `1px solid ${T.error}30`,
              display: "flex", alignItems: "center", gap: 1.5,
              animation: `${fadeUp} 0.3s ease-out`,
            }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: T.error, flexShrink: 0 }} />
              <Typography sx={{ fontFamily: T.fontBody, color: T.error, fontSize: "0.85rem" }}>
                {error}
              </Typography>
            </Box>
          )}

          {/* ── BRAND GRID ── */}
          <Grid container spacing={3} justifyContent="center">
            {brands.map((brand, idx) => (
              <Grid key={brand.id} sx={{ animation: `${fadeUp} 0.5s ease-out`, animationDelay: `${idx * 0.07}s`, animationFillMode: "both" }}>
                <BrandCard
                  brand={brand}
                  onClick={handleBrandClick}
                  onRename={openRenameDialog}
                  onClone={handleCloneSubmit}
                  onDelete={openDeleteDialog}
                />
              </Grid>
            ))}
            <Grid sx={{ animation: `${fadeUp} 0.5s ease-out`, animationDelay: `${brands.length * 0.07}s`, animationFillMode: "both" }}>
              <CreateBrandCard onCreate={handleBrandCreated} />
            </Grid>
          </Grid>

          {/* Stats footer strip */}
          {brands.length > 0 && (
            <Box sx={{
              mt: 10, display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap",
              animation: `${fadeUp} 0.6s ease-out 0.4s both`,
            }}>
              {[
                { label: "Tổng thương hiệu", value: brands.length, color: T.primary },
                { label: "Đang hoạt động",   value: brands.length, color: T.success },
                { label: "Cập nhật hôm nay", value: Math.min(brands.length, 3), color: T.accent },
              ].map(({ label, value, color }) => (
                <Box key={label} sx={{
                  px: 3, py: 2, borderRadius: "14px",
                  border: `1px solid ${T.border}`,
                  bgcolor: "rgba(255,255,255,0.02)",
                  backdropFilter: "blur(10px)",
                  textAlign: "center", minWidth: 140,
                }}>
                  <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1.6rem", color, lineHeight: 1 }}>
                    {value}
                  </Typography>
                  <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textMuted, mt: 0.5, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {label}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* ──────────────────────────────────
            DIALOG: RENAME
        ────────────────────────────────── */}
        <Dialog
          open={dialogs.rename}
          onClose={closeDialogs}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: dialogPaperSx }}
          BackdropProps={{ sx: { backdropFilter: "blur(8px)", bgcolor: "rgba(4,8,15,0.6)" } }}
        >
          <DialogTitle sx={{ px: 3, pt: 3, pb: 2, borderBottom: `1px solid ${T.border}` }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              {/* Accent bar */}
              <Box sx={{ width: 3, height: 20, borderRadius: "2px", bgcolor: T.primary, boxShadow: `0 0 8px ${T.primaryGlow}` }} />
              <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem", color: T.textPrimary }}>
                Đổi tên Thương hiệu
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 3 }}>
            <TextField
              autoFocus
              fullWidth
              variant="outlined"
              placeholder="Nhập tên mới…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              error={!!renameError}
              helperText={renameError}
              onKeyPress={e => e.key === 'Enter' && handleRenameSubmit()}
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "rgba(255,255,255,0.03)", borderRadius: "10px",
                  color: T.textPrimary, fontFamily: T.fontBody,
                  "& fieldset": { borderColor: renameError ? T.error : T.border },
                  "&:hover fieldset": { borderColor: T.borderHover },
                  "&.Mui-focused fieldset": { borderColor: T.primary },
                  "&.Mui-focused": { boxShadow: `0 0 0 3px ${T.primaryGlow}` },
                },
                "& .MuiFormHelperText-root": { color: T.error, fontFamily: T.fontBody, fontSize: "0.75rem" },
                "& input": { fontFamily: T.fontBody, "&::placeholder": { color: T.textMuted, opacity: 1 } },
              }}
            />
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
            <Button onClick={closeDialogs} sx={{
              fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
              color: T.textMuted, borderRadius: "10px",
              "&:hover": { color: T.textPrimary, bgcolor: "rgba(255,255,255,0.04)" },
            }}>
              Hủy bỏ
            </Button>
            <Button onClick={handleRenameSubmit} variant="contained" sx={{
              fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
              borderRadius: "10px", px: 3,
              background: `linear-gradient(135deg, ${T.primary}, #0d9488)`,
              boxShadow: `0 4px 20px ${T.primaryGlow}`,
              "&:hover": { boxShadow: `0 6px 28px ${T.primaryGlow}`, transform: "translateY(-1px)" },
              transition: "all 0.2s ease",
            }}>
              Lưu thay đổi
            </Button>
          </DialogActions>
        </Dialog>

        {/* ──────────────────────────────────
            DIALOG: DELETE
        ────────────────────────────────── */}
        <Dialog
          open={dialogs.delete}
          onClose={closeDialogs}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { ...dialogPaperSx, border: `1px solid rgba(248, 113, 113, 0.15)` } }}
          BackdropProps={{ sx: { backdropFilter: "blur(8px)", bgcolor: "rgba(4,8,15,0.6)" } }}
        >
          <DialogTitle sx={{ px: 3, pt: 3, pb: 2, borderBottom: `1px solid rgba(248, 113, 113, 0.12)` }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 3, height: 20, borderRadius: "2px", bgcolor: T.error, boxShadow: `0 0 8px ${T.error}60` }} />
              <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem", color: T.error }}>
                Xóa Thương hiệu
              </Typography>
            </Box>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 3 }}>
            <Typography sx={{ fontFamily: T.fontBody, color: T.textSecond, fontSize: "0.9rem", lineHeight: 1.7 }}>
              Bạn có chắc chắn muốn xóa thương hiệu{" "}
              <Box component="span" sx={{
                fontWeight: 700, color: T.textPrimary,
                px: 0.5, py: 0.1, borderRadius: "4px",
                bgcolor: "rgba(255,255,255,0.06)",
                fontFamily: T.fontMono, fontSize: "0.85rem",
              }}>
                "{selectedBrand?.name}"
              </Box>
              ?
            </Typography>

            {/* Warning box */}
            <Box sx={{
              mt: 2.5, p: "12px 16px", borderRadius: "10px",
              bgcolor: "rgba(245, 158, 11, 0.08)", border: `1px solid rgba(245, 158, 11, 0.25)`,
              display: "flex", gap: 1.5, alignItems: "flex-start",
            }}>
              <Typography sx={{ color: T.gold, fontSize: "0.85rem", lineHeight: 1 }}>⚠</Typography>
              <Typography sx={{ fontFamily: T.fontBody, color: T.gold, fontSize: "0.82rem", lineHeight: 1.5 }}>
                Hành động này không thể hoàn tác. Toàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.
              </Typography>
            </Box>
          </DialogContent>

          <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
            <Button onClick={closeDialogs} sx={{
              fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
              color: T.textMuted, borderRadius: "10px",
              "&:hover": { color: T.textPrimary, bgcolor: "rgba(255,255,255,0.04)" },
            }}>
              Hủy bỏ
            </Button>
            <Button onClick={handleDeleteSubmit} variant="contained" sx={{
              fontFamily: T.fontBody, fontWeight: 700, textTransform: "none",
              borderRadius: "10px", px: 3,
              bgcolor: T.error,
              background: `linear-gradient(135deg, ${T.error}, #dc2626)`,
              boxShadow: `0 4px 20px rgba(248, 113, 113, 0.25)`,
              "&:hover": {
                boxShadow: `0 6px 28px rgba(248, 113, 113, 0.35)`,
                transform: "translateY(-1px)",
              },
              transition: "all 0.2s ease",
            }}>
              Xác nhận xóa
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </>
  );
}

export default BrandLobby;