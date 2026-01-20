import React, { useEffect, useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, 
    Grid, Paper, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Avatar, CircularProgress, Stack 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

// Tái sử dụng từ dự án
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useBrand } from '../../context/BrandContext';
import { fetchCustomerDetailAPI } from '../../services/api';
import { StatItem } from '../dashboard/StatItem';

const OrderStatusChip = ({ status, category }) => {
    let color = 'text.secondary';
    let label = status;

    if (category) {
        switch (category) {
            case 'completed':
                color = 'success.main';
                label = 'Thành công';
                break;
            case 'processing':
                color = 'info.main';
                label = 'Đang xử lý';
                break;
            case 'cancelled':
                color = 'warning.main';
                label = 'Đã hủy';
                break;
            case 'bomb':
                color = 'error.main';
                label = 'Bom hàng';
                break;
            case 'refunded':
                color = 'error.main';
                label = 'Đơn hoàn';
                break;
            default:
                // Fallback nếu category lạ
                break;
        }
    } else {
        // Logic cũ (Fallback)
        const s = status?.toLowerCase() || '';
        if (s.includes('completed') || s.includes('delivered') || s.includes('thành công')) {
            color = 'success.main';
            label = 'Thành công';
        } else if (s.includes('processing') || s.includes('đang') || s.includes('chờ')) {
            color = 'info.main';
            label = 'Đang xử lý';
        } else if (s.includes('cancel') || s.includes('hủy')) {
            color = 'warning.main';
            label = 'Đã hủy';
        } else if (s.includes('bomb') || s.includes('return') || s.includes('hoàn')) {
            color = 'error.main';
            label = 'Bom/Hoàn';
        }
    }

    return (
        <Typography variant="caption" sx={{ color, fontWeight: 'bold', textTransform: 'uppercase' }}>
            {label}
        </Typography>
    );
};

// Component con hiển thị chỉ số nhỏ
const DetailStatBox = ({ label, value, color, isBold = false }) => (
    <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        p: 1, 
        bgcolor: 'rgba(255,255,255,0.03)', 
        borderRadius: 2 
    }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, fontSize: '0.7rem' }}>
            {label}
        </Typography>
        <Typography variant="h6" fontWeight={isBold ? '800' : '600'} sx={{ color: color, fontSize: '1.1rem' }}>
            {value || 0}
        </Typography>
    </Box>
);

const CustomerDetailDialog = ({ open, onClose, username }) => {
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
            {/* Header sử dụng style mặc định của Theme MuiDialogTitle (đã có in hoa, căn giữa, glow) */}
            <DialogTitle sx={{ m: 0, p: 2, position: 'relative', textAlign: 'left !important', textTransform: 'none !important' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 48, height: 48 }}>
                        <PersonIcon />
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ color: 'primary.main', textShadow: 'none' }}>
                            Hồ sơ Khách hàng
                        </Typography>
                        <Typography variant="subtitle2" color="text.secondary">
                            @{username}
                        </Typography>
                    </Box>
                </Box>
                <IconButton
                    onClick={onClose}
                    sx={{ position: 'absolute', right: 16, top: 20, color: 'text.secondary' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers sx={{ pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 10 }}><CircularProgress /></Box>
                ) : data ? (
                    <Stack spacing={4}>
                        {/* 1. INFO GRID - Sức khỏe khách hàng */}
                        <Paper variant="glass" sx={{ p: 3 }}>
                            {/* Hàng 1: Tài chính & Đánh giá tổng quan */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                                <StatItem 
                                    title="Tổng Chi Tiêu Thực Tế" 
                                    value={info.total_spent} 
                                    format="currency"
                                />
                                
                                {/* Logic Đánh giá */}
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem', mb: 0.5 }}>
                                        Đánh giá tín nhiệm
                                    </Typography>
                                    {(() => {
                                        const isRefund = info.refunded_orders > 0;
                                        const isBomb = info.bomb_orders > 0;
                                        const total = info.total_orders || 0;
                                        const cancelRate = total > 0 ? (info.cancelled_orders / total) : 0;
                                        const isHighCancel = total > 3 && cancelRate > 0.4; // Hủy > 40% và > 3 đơn

                                        let label = "Uy tín";
                                        let color = "success.main";
                                        let bg = "rgba(76, 175, 80, 0.1)";

                                        if (isRefund) {
                                            label = "BÁO ĐỘNG (HOÀN TIỀN)";
                                            color = "#FF5252"; // Đỏ tươi
                                            bg = "rgba(255, 82, 82, 0.1)";
                                        } else if (isBomb) {
                                            label = "CẢNH BÁO (BOM HÀNG)";
                                            color = "#FF9800"; // Cam
                                            bg = "rgba(255, 152, 0, 0.1)";
                                        } else if (isHighCancel) {
                                            label = "Cần chú ý (Hủy nhiều)";
                                            color = "#FFC107"; // Vàng
                                            bg = "rgba(255, 193, 7, 0.1)";
                                        }

                                        return (
                                            <Box sx={{ 
                                                display: 'inline-block',
                                                px: 2, py: 0.5, 
                                                borderRadius: 2, 
                                                bgcolor: bg,
                                                border: `1px solid ${color}`
                                            }}>
                                                <Typography variant="h6" fontWeight="bold" sx={{ color: color }}>
                                                    {label}
                                                </Typography>
                                            </Box>
                                        );
                                    })()}
                                </Box>
                            </Box>

                            {/* Hàng 2: Chi tiết các chỉ số đơn hàng */}
                            <Box sx={{ 
                                display: 'grid', 
                                gridTemplateColumns: 'repeat(5, 1fr)', 
                                gap: 2,
                                pt: 2,
                                borderTop: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <DetailStatBox label="Tổng đơn" value={info.total_orders} color="text.primary" />
                                <DetailStatBox label="Thành công" value={info.completed_orders} color="success.main" />
                                <DetailStatBox label="Đã hủy" value={info.cancelled_orders} color="warning.main" />
                                <DetailStatBox label="Bom hàng" value={info.bomb_orders} color="error.main" />
                                <DetailStatBox label="Hoàn tiền" value={info.refunded_orders} color="#FF5252" isBold={true} />
                            </Box>
                            
                            <Box sx={{ mt: 2, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="caption" color="text.secondary">
                                    📍 {[info.district, info.province].filter(Boolean).join(' - ') || 'Chưa có địa chỉ'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    📅 Đơn cuối: {formatDate(info.last_order_date)}
                                </Typography>
                            </Box>
                        </Paper>

                        {/* 2. ORDER HISTORY - Sử dụng style table chuẩn của dự án */}
                        <Box>
                            <Typography variant="subtitle2" sx={{ mb: 2, color: 'primary.main', fontWeight: 'bold' }}>LỊCH SỬ GIAO DỊCH</Typography>
                            <TableContainer sx={{ maxHeight: 350 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Mã Đơn</TableCell>
                                            <TableCell>Mã Vận Đơn</TableCell>
                                            <TableCell>Ngày đặt</TableCell>
                                            <TableCell>Trạng thái</TableCell>
                                            <TableCell align="right">Giá trị</TableCell>
                                            <TableCell>Nguồn</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {orders.map((order) => (
                                            <TableRow key={order.order_code} hover>
                                                <TableCell sx={{ fontFamily: 'monospace' }}>{order.order_code}</TableCell>
                                                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                                                    {order.tracking_id || '---'}
                                                </TableCell>
                                                <TableCell>{formatDate(order.order_date)}</TableCell>
                                                <TableCell><OrderStatusChip status={order.status} category={order.category} /></TableCell>
                                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatCurrency(order.net_revenue || 0)}</TableCell>
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