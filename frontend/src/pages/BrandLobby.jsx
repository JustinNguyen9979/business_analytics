// FILE: src/pages/BrandLobby.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Toàn bộ CSS/style đã được chuyển sang:
//   src/theme/designSystem.js  — tokens, keyframes, shared components
//   src/styles/global.css      — CSS thuần, Google Fonts, resets
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Typography, Box, Grid,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, Tooltip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

// ── Shared design system ──────────────────────────────────────────────────────
import {
  T,
  fadeUp, shimmer, pulseFade, scan,
  Noise, AmbientOrbs, GridOverlay, ScanLine,
  LoadingScreen,
  dialogPaperSx, dialogBackdropSx,
  AccentBar, LiveBadge, EyebrowLabel, ShimmerText,
  StyledInput,
} from "../theme/designSystem";

// ── API & Components ──────────────────────────────────────────────────────────
import { getAllBrands, createBrand, deleteBrand, updateBrand, cloneBrand } from "../services/api";
import BrandCard from "../components/brand/BrandCard";
import CreateBrandCard from "../components/brand/CreateBrandCard";

/* =========================================================
   CONSTANTS & DATA
========================================================= */
const INSIGHTS = [
  "Nếu thấy biên lợi nhuận tụt ở hơn 2 thương hiệu, hãy xem lại chiến lược discount trong 30 ngày qua.",
  "Tỷ lệ khách hàng quay lại đang có xu hướng giảm, hãy kiểm tra lại các chương trình chăm sóc khách hàng thân thiết.",
  "Chi phí quảng cáo (ADS) đang tăng cao nhưng tỷ lệ chuyển đổi không đổi, có thể tệp đối tượng đang bị bão hòa.",
  "Khi 1 thương hiệu liên tục vượt target 3 tháng, có lẽ đã đến lúc tăng ngân sách marketing cho nó.",
  "Không phải brand nào cũng cần bán nhiều hơn. Một số chỉ cần bán đúng hơn.",
  "Dữ liệu không nói dối, nhưng cũng không tự kể chuyện – AnalyticsPRO là người phiên dịch.",
  "Bạn có chắc thương hiệu mang lại nhiều doanh thu nhất cũng là thương hiệu sinh lời tốt nhất?",
  "Nếu phải cắt 1 thương hiệu khỏi portfolio hôm nay, bạn sẽ chọn cái nào?",
  "Hôm nay các thương hiệu của bạn đang đi đúng quỹ đạo, nhưng biên lợi nhuận bắt đầu mỏng dần.",
  "Bức tranh doanh thu ổn định, điều đáng chú ý nằm ở tốc độ xoay vòng hàng tồn.",
  "Sản phẩm chủ lực đang bị cạnh tranh về giá, cân nhắc tối ưu lại chi phí vận hành để giữ biên lợi nhuận.",
  "Dữ liệu cho thấy khung giờ từ 20h - 22h có lượng truy cập cao nhất, hãy tập trung ngân sách marketing vào khung giờ này."
];

/* =========================================================
   MAIN COMPONENT
========================================================= */
function BrandLobby() {
  const [brands, setBrands]             = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const navigate                        = useNavigate();
  const [dialogs, setDialogs]           = useState({ rename: false, delete: false });
  const [selectedBrand, setSelected]    = useState(null);
  const [newName, setNewName]           = useState("");
  const [confirmDeleteName, setConfirmDeleteName] = useState("");
  const [renameError, setRenameError]   = useState("");

  const randomInsight = useMemo(() => INSIGHTS[Math.floor(Math.random() * INSIGHTS.length)], []);

  /* ── Data fetching ── */
  const fetchBrands = async () => {
    try {
      setError(null); setLoading(true);
      setBrands(await getAllBrands());
    } catch {
      setError("Không thể tải danh sách Brand từ server.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchBrands(); }, []);

  /* ── Handlers ── */
  const handleBrandClick   = slug => navigate(`/dashboard/${slug}`);
  const handleBrandCreated = async name => {
    if (!name) return;
    try { setError(null); await createBrand(name); fetchBrands(); }
    catch (err) { throw err; }
  };

  const openRenameDialog = brand => {
    setSelected(brand); setNewName(brand.name); setRenameError("");
    setDialogs({ ...dialogs, rename: true });
  };
  const openDeleteDialog = brand => {
    setSelected(brand); 
    setConfirmDeleteName("");
    setDialogs({ ...dialogs, delete: true });
  };
  const closeDialogs = () => {
    setDialogs({ rename: false, delete: false }); 
    setSelected(null); 
    setRenameError("");
    setConfirmDeleteName("");
  };

  const handleRenameSubmit = async () => {
    const trimmed = newName.trim();
    if (!trimmed || !selectedBrand) return;
    try { await updateBrand(selectedBrand.id, trimmed); fetchBrands(); closeDialogs(); }
    catch (err) { setRenameError(err.response?.data?.detail || "Lỗi không xác định."); }
  };

  const handleCloneSubmit = async brandId => {
    try { setError(null); await cloneBrand(brandId); fetchBrands(); }
    catch (err) { setError(err.response?.data?.detail || "Lỗi khi nhân bản."); }
  };

  const handleDeleteSubmit = async () => {
    if (!selectedBrand) return;
    try { setError(null); await deleteBrand(selectedBrand.id); fetchBrands(); closeDialogs(); }
    catch (err) { setError(err.response?.data?.detail || "Lỗi khi xóa."); }
  };

  if (loading) return <LoadingScreen />;

  /* ── Render ── */
  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: T.bg, position: "relative", fontFamily: T.fontBody }}>
      {/* ── Background layers (from designSystem) ── */}
      <Noise />
      <AmbientOrbs />
      <GridOverlay />
      <ScanLine />

      {/* ══════════════════════════════════════════
          FIXED HEADER
      ══════════════════════════════════════════ */}
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3"  y="12" width="4" height="9"  rx="1" fill={T.primary} opacity="0.7"/>
              <rect x="10" y="7"  width="4" height="14" rx="1" fill={T.primary} opacity="0.9"/>
              <rect x="17" y="3"  width="4" height="18" rx="1" fill={T.primary}/>
            </svg>
          </Box>
          <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "0.95rem", color: T.textPrimary, letterSpacing: "0.04em" }}>
            ANALYTICS<Box component="span" sx={{ color: T.primary }}>PRO</Box>
          </Typography>
        </Box>

        {/* Right side */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* LiveBadge from designSystem */}
          <LiveBadge />

          {/* Brand count */}
          <Box sx={{ px: 1.5, py: 0.75, borderRadius: "20px", border: `1px solid ${T.border}`, bgcolor: "rgba(255,255,255,0.02)" }}>
            <Typography sx={{ fontFamily: T.fontMono, fontSize: "0.6rem", color: T.textMuted, letterSpacing: "1px" }}>
              {brands.length} THƯƠNG HIỆU
            </Typography>
          </Box>

          {/* Logout */}
          <Tooltip title="Đăng xuất" placement="bottom">
            <IconButton onClick={() => { localStorage.removeItem("token"); navigate("/login"); }} sx={{
              width: 36, height: 36, borderRadius: "10px",
              border: `1px solid rgba(248, 113, 113, 0.2)`,
              bgcolor: "rgba(248, 113, 113, 0.06)", color: T.error,
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

      {/* ══════════════════════════════════════════
          MAIN CONTENT
      ══════════════════════════════════════════ */}
      <Box sx={{ position: "relative", zIndex: 1, pt: "96px", pb: "80px", px: { xs: 3, sm: 5, md: 8, lg: 12 } }}>

        {/* Page header */}
        <Box sx={{ textAlign: "center", mb: 8, animation: `${fadeUp} 0.6s ease-out` }}>
          {/* EyebrowLabel from designSystem */}
          <EyebrowLabel>Brand Management</EyebrowLabel>

          <Typography sx={{
            fontFamily: T.fontDisplay, fontWeight: 800,
            fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
            color: T.textPrimary, lineHeight: 1.15, mb: 1.5,
          }}>
            Business{" "}
            {/* ShimmerText from designSystem */}
            <ShimmerText>Analytics</ShimmerText>
          </Typography>

          <Typography sx={{ fontFamily: T.fontBody, color: T.textMuted, fontSize: "0.95rem", maxWidth: 500, mx: "auto", lineHeight: 1.7 }}>
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
            <Typography sx={{ fontFamily: T.fontBody, color: T.error, fontSize: "0.85rem" }}>{error}</Typography>
          </Box>
        )}

        {/* Brand grid */}
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

        {/* Random Insights Footer */}
        <Box sx={{
          mt: 12, textAlign: "center", maxWidth: 700, mx: "auto",
          animation: `${fadeUp} 0.8s ease-out 0.5s both`,
        }}>
          <Box sx={{
            px: 4, py: 2.5, borderRadius: T.radiusLg,
            border: `1px solid ${T.primary}15`,
            bgcolor: "rgba(255,255,255,0.02)",
            backdropFilter: "blur(10px)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Trang trí góc */}
            <Box sx={{ position: "absolute", top: 0, left: 0, width: 20, height: 20, borderLeft: `2px solid ${T.primary}40`, borderTop: `2px solid ${T.primary}40`, borderRadius: "4px 0 0 0" }} />
            <Box sx={{ position: "absolute", bottom: 0, right: 0, width: 20, height: 20, borderRight: `2px solid ${T.primary}40`, borderBottom: `2px solid ${T.primary}40`, borderRadius: "0 0 4px 0" }} />

            <Typography sx={{
              fontFamily: T.fontMono, fontSize: "0.6rem", color: T.primary,
              letterSpacing: "2px", mb: 1.5, textTransform: "uppercase", opacity: 0.8,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 1
            }}>
              <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: T.primary }} />
              AI Insight Daily
              <Box sx={{ width: 4, height: 4, borderRadius: "50%", bgcolor: T.primary }} />
            </Typography>
            
            <Typography sx={{
              fontFamily: T.fontBody, color: T.textSecond, fontSize: "0.85rem",
              lineHeight: 1.6, fontStyle: "italic",
            }}>
              "{randomInsight}"
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ══════════════════════════════════════════
          DIALOG: RENAME
      ══════════════════════════════════════════ */}
      <Dialog
        open={dialogs.rename} onClose={closeDialogs}
        maxWidth="xs" fullWidth
        PaperProps={{ sx: dialogPaperSx }}
        BackdropProps={{ sx: dialogBackdropSx }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 2, borderBottom: `1px solid ${T.border}` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {/* AccentBar from designSystem */}
            <AccentBar />
            <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem", color: T.textPrimary }}>
              Đổi tên Thương hiệu
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          {/* StyledInput from designSystem */}
          <StyledInput
            autoFocus fullWidth variant="outlined"
            placeholder="Nhập tên mới…"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            hasError={!!renameError}
            helperText={renameError}
            onKeyPress={e => e.key === "Enter" && handleRenameSubmit()}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
          <Button onClick={closeDialogs} sx={{
            fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
            color: T.textMuted, borderRadius: "10px",
            transition: "all 0.2s ease",
            "&:hover": { color: T.primary, bgcolor: "transparent" },
          }}>
            Hủy bỏ
          </Button>
          <Button onClick={handleRenameSubmit} variant="contained" sx={{
            fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
            borderRadius: "10px", px: 3,
            background: `linear-gradient(135deg, ${T.primary}, #0d9488)`,
            boxShadow: `0 4px 20px ${T.primaryGlow}`,
            transition: "all 0.2s ease",
            "&:hover": { boxShadow: `0 6px 28px ${T.primaryGlow}`, transform: "translateY(-1px)" },
          }}>
            Lưu thay đổi
          </Button>
        </DialogActions>
      </Dialog>

      {/* ══════════════════════════════════════════
          DIALOG: DELETE
      ══════════════════════════════════════════ */}
      <Dialog
        open={dialogs.delete} onClose={closeDialogs}
        maxWidth="xs" fullWidth
        PaperProps={{ 
          sx: { 
            ...dialogPaperSx, 
            border: `1px solid rgba(248, 113, 113, 0.15)`,
            width: 'calc(100% + 5px)',
            maxWidth: '465px'
          } 
        }}
        BackdropProps={{ sx: dialogBackdropSx }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 2, borderBottom: `1px solid rgba(248, 113, 113, 0.12)` }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {/* AccentBar từ designSystem, màu error */}
            <AccentBar color={T.error} />
            <Typography sx={{ fontFamily: T.fontDisplay, fontWeight: 700, fontSize: "1rem", color: T.error }}>
              Xóa Thương hiệu
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 3 }}>
          <Typography sx={{ fontFamily: T.fontBody, color: T.textSecond, fontSize: "0.9rem", lineHeight: 1.7, mb: 2 }}>
            Bạn có chắc chắn muốn xóa thương hiệu{" "}
            <Box component="span" sx={{
              fontWeight: 700, color: T.textPrimary,
              px: 0.5, borderRadius: "4px",
              bgcolor: "rgba(255,255,255,0.06)",
              fontFamily: T.fontMono, fontSize: "0.85rem",
            }}>
              "{selectedBrand?.name}"
            </Box>
            ? Toàn bộ dữ liệu sẽ bị <Box component="span" sx={{ color: T.error, fontWeight: 800 }}>XÓA VĨNH VIỄN</Box> và không thể khôi phục.
          </Typography>

          <Box sx={{
            mb: 3, p: "12px 16px", borderRadius: "10px",
            bgcolor: T.errorDim, border: `1px solid rgba(248, 113, 113, 0.2)`,
            display: "flex", gap: 1.5, alignItems: "center",
          }}>
            <Typography sx={{ color: T.error, fontSize: "1.2rem", lineHeight: 1, display: "flex" }}>⚠</Typography>
            <Typography sx={{ fontFamily: T.fontBody, color: T.error, fontSize: "0.82rem", lineHeight: 1.5 }}>
              Vui lòng nhập chính xác tên thương hiệu để xác nhận.
            </Typography>
          </Box>

          <StyledInput
            fullWidth
            variant="outlined"
            placeholder={`Nhập "${selectedBrand?.name}" để xóa...`}
            value={confirmDeleteName}
            onChange={(e) => setConfirmDeleteName(e.target.value)}
            onKeyPress={(e) => {
                if (e.key === "Enter" && confirmDeleteName === selectedBrand?.name) {
                    handleDeleteSubmit();
                }
            }}
            sx={{
                "& .MuiOutlinedInput-root": {
                    backgroundColor: "rgba(248, 113, 113, 0.03)",
                    "&.Mui-focused": {
                        backgroundColor: "rgba(248, 113, 113, 0.06)",
                        boxShadow: `0 0 0 3px rgba(248, 113, 113, 0.1)`,
                        "& fieldset": { borderColor: T.error },
                    },
                }
            }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
          <Button onClick={closeDialogs} sx={{
            fontFamily: T.fontBody, fontWeight: 600, textTransform: "none",
            color: T.textMuted, borderRadius: "10px",
            transition: "all 0.2s ease",
            "&:hover": { color: T.primary, bgcolor: "transparent" },
          }}>
            Hủy bỏ
          </Button>
          <Button 
            onClick={handleDeleteSubmit} 
            variant="contained" 
            disabled={confirmDeleteName !== selectedBrand?.name}
            sx={{
              fontFamily: T.fontBody, fontWeight: 700, textTransform: "none",
              borderRadius: "12px", px: 4, py: 1.2,
              background: confirmDeleteName === selectedBrand?.name 
                ? `linear-gradient(135deg, #f43f5e 0%, #881337 100%)` 
                : "rgba(255,255,255,0.05)",
              color: confirmDeleteName === selectedBrand?.name ? "#fff" : "rgba(255,255,255,0.2)",
              boxShadow: confirmDeleteName === selectedBrand?.name 
                ? `0 8px 25px -5px rgba(244, 63, 94, 0.5), inset 0 1px 0 rgba(255,255,255,0.2)` 
                : "none",
              transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              position: 'relative',
              overflow: 'hidden',
              "&:hover": { 
                  background: `linear-gradient(135deg, #fb7185 0%, #9f1239 100%)`,
                  boxShadow: `0 12px 30px -5px rgba(244, 63, 94, 0.6), inset 0 1px 0 rgba(255,255,255,0.3)`, 
                  transform: "translateY(-2px)",
              },
              "&.Mui-disabled": {
                  background: "rgba(255,255,255,0.03)",
                  color: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.05)"
              },
              // Hiệu ứng loé sáng nhẹ (Shine)
              "&::after": {
                  content: '""',
                  position: 'absolute',
                  top: 0, left: '-100%',
                  width: '100%', height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                  transition: '0.5s',
              },
              "&:hover::after": {
                  left: '100%',
              }
            }}
          >
            Xác nhận xóa vĩnh viễn
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default BrandLobby;