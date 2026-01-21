import React, { useEffect, useState, useMemo } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, 
    Paper, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Avatar, CircularProgress, Stack, useTheme 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';

// Common & Utils
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useBrand } from '../../context/BrandContext';
import { fetchCustomerDetailAPI } from '../../services/api';
import OrderStatusChip from '../common/OrderStatusChip';
import SectionTitle from '../ui/SectionTitle';

// --- HELPER COMPONENTS ---

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

const CustomerDetailDialog = ({ open, onClose, username }) => {
    const theme = useTheme();
    const { slug } = useBrand();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState(null);

    useEffect(() => {
        if (open && username && slug) {
            setLoading(true);
            fetchCustomerDetailAPI(slug, username)
                .then(res => setData(res))
                .catch(err => console.error(err))
                .finally(() => setLoading(false));
        }
    }, [open, username, slug]);

    const info = data?.info || {};
    const orders = data?.orders || [];

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                textTransform: 'none !important', // Ghi đè in hoa từ theme
                textAlign: 'left !important'      // Ghi đè canh giữa từ theme
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', width: 45, height: 45 }}>
                        <PersonIcon />
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 'bold' }}>
                            Hồ sơ Khách hàng
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '1rem' }}>
                            @{username}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary' }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
                ) : data ? (
                    <Stack spacing={3}>
                        {/* 1. INFO CARD */}
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

                        {/* 2. ORDER HISTORY */}
                        <Box>
                            <SectionTitle>LỊCH SỬ GIAO DỊCH</SectionTitle>
                            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 350, bgcolor: 'background.paper' }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Mã Đơn Hàng</TableCell>
                                            <TableCell>Mã Vận Đơn</TableCell>
                                            <TableCell>Ngày Đặt</TableCell>
                                            <TableCell>Trạng Thái</TableCell>
                                            <TableCell align="right">Giá Trị Đơn</TableCell>
                                            <TableCell>Nguồn</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {orders.map((order) => (
                                            <TableRow key={order.order_code} hover>
                                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 500 }}>{order.order_code}</TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{order.tracking_id || '---'}</TableCell>
                                                <TableCell>{formatDate(order.order_date)}</TableCell>
                                                <TableCell>
                                                    <OrderStatusChip status={order.status} category={order.category} />
                                                </TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
                                                    {formatCurrency(order.net_revenue || 0)}
                                                </TableCell>
                                                <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>{order.source}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Stack>
                ) : null}
            </DialogContent>
        </Dialog>
    );
};

export default CustomerDetailDialog;