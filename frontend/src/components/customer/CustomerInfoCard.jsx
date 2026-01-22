import React, { useMemo } from 'react';
import { 
    Box, Paper, Typography, Stack, useTheme
} from '@mui/material';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import { formatCurrency, formatDate } from '../../utils/formatters';

// --- SUB-COMPONENTS ---
const DetailStatBox = ({ label, value, color, isBold = false }) => (
    <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        p: 1.5, 
        bgcolor: 'action.hover', 
        borderRadius: 2,
        border: '1px solid transparent',
        transition: 'all 0.2s ease-in-out',
        cursor: 'default',
        '&:hover': { 
            transform: 'translateY(-3px)',
            borderColor: 'primary.main',
            boxShadow: '0 4px 12px rgba(0, 229, 255, 0.15)',
            bgcolor: 'rgba(0, 229, 255, 0.05)'
        }
    }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            {label}
        </Typography>
        <Typography variant="h6" fontWeight={isBold ? '800' : '600'} sx={{ color: color }}>
            {value || 0}
        </Typography>
    </Box>
);

const CreditRatingBadge = ({ info }) => {
    const theme = useTheme();

    const rating = useMemo(() => {
        const isRefund = info.refunded_orders > 0;
        const isBomb = info.bomb_orders > 0;
        const total = info.total_orders || 0;
        const cancelRate = total > 0 ? (info.cancelled_orders / total) : 0;
        const isHighCancel = total > 3 && cancelRate > 0.4;

        if (isRefund) {
            return { label: "BÁO ĐỘNG (HOÀN TIỀN)", color: theme.palette.error.main, bg: 'rgba(255, 23, 68, 0.1)' };
        }
        if (isBomb) {
            return { label: "CẢNH BÁO (BOM HÀNG)", color: theme.palette.warning.main, bg: 'rgba(255, 234, 0, 0.1)' };
        }
        if (isHighCancel) {
            return { label: "Cần chú ý (Hủy nhiều)", color: theme.palette.warning.light, bg: 'rgba(255, 234, 0, 0.05)' };
        }
        return { label: "Uy tín", color: theme.palette.success.main, bg: 'rgba(0, 230, 118, 0.1)' };
    }, [info, theme]);

    return (
        <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', display: 'block', mb: 0.5 }}>
                Đánh giá tín nhiệm
            </Typography>
            <Box sx={{ 
                display: 'inline-block',
                px: 2, py: 0.5, 
                borderRadius: 2, 
                bgcolor: rating.bg,
                border: `1px solid ${rating.color}`,
                boxShadow: `0 0 10px ${rating.bg}`
            }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ color: rating.color }}>
                    {rating.label}
                </Typography>
            </Box>
        </Box>
    );
};

// --- MAIN COMPONENT ---
const CustomerInfoCard = ({ info }) => {
    const theme = useTheme();

    return (
        <Paper variant="glass" sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                {/* Tổng chi tiêu */}
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ 
                        p: 2, borderRadius: 3, 
                        bgcolor: 'rgba(0, 229, 255, 0.1)', 
                        color: 'primary.main',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <LocalMallIcon fontSize="large" />
                    </Box>
                    <Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                            <Typography variant="h6" color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>
                                Tổng chi thực tế:
                            </Typography>
                            <Typography variant="h6" sx={{ fontSize: '1.5rem !important', fontWeight: 900 }}>
                                {formatCurrency(info.total_spent)}
                            </Typography>
                        </Box>
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 0.5 }}>
                            <MonetizationOnIcon sx={{ fontSize: '1.2rem', color: 'success.main' }} />
                            <Typography variant="caption" color="text.secondary" sx={{fontSize: '1rem'}}>
                                AOV: <Box component="span" sx={{ color: 'text.primary', fontWeight: 'bold' }}>{formatCurrency(info.aov || 0)}</Box> / đơn
                            </Typography>
                        </Stack>
                    </Box>
                </Box>
                
                {/* Đánh giá tín nhiệm */}
                <CreditRatingBadge info={info} />
            </Box>

            {/* Grid Stats */}
            <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(6, 1fr)', 
                gap: 2, pt: 3,
                borderTop: `1px solid ${theme.palette.divider}`
            }}>
                <DetailStatBox label="Tổng đơn" value={info.total_orders} color="text.primary" />
                <DetailStatBox label="Thành công" value={info.completed_orders} color="success.main" />
                <DetailStatBox label="Đã hủy" value={info.cancelled_orders} color="warning.main" />
                <DetailStatBox label="Bom hàng" value={info.bomb_orders} color="error.main" />
                <DetailStatBox label="Hoàn tiền" value={info.refunded_orders} color="error.main" isBold />
                <DetailStatBox label="Chu kỳ mua" value={info.avg_repurchase_cycle ? `${Math.round(info.avg_repurchase_cycle)} ngày` : '-'} color="info.main" />
            </Box>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', opacity: 0.7 }}>
                <Typography variant="body2">📍 {[info.district, info.province].filter(Boolean).join(' - ') || 'Chưa có địa chỉ'}</Typography>
                <Typography variant="body2">📅 Đơn cuối: {formatDate(info.last_order_date)}</Typography>
            </Box>
        </Paper>
    );
};

export default CustomerInfoCard;