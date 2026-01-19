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
                        {/* 1. INFO GRID - Sử dụng StatItem đã có sẵn */}
                        <Paper variant="glass" sx={{ p: 3 }}>
                            <Grid container spacing={4}>
                                <Grid item xs={12} sm={4}>
                                    <StatItem 
                                        title="Tổng Chi Tiêu" 
                                        value={info.total_spent} 
                                        format="currency"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <StatItem 
                                        title="Tổng Đơn Hàng" 
                                        value={info.total_orders} 
                                        format="number"
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <Box>
                                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.75rem' }}>Trạng thái</Typography>
                                        <Typography variant="h6" fontWeight="600" sx={{ color: info.bomb_orders > 0 ? 'error.main' : 'success.main' }}>
                                            {info.bomb_orders > 0 ? `${info.bomb_orders} Đơn bom` : "Uy tín"}
                                        </Typography>
                                    </Box>
                                </Grid>
                            </Grid>
                            
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 4 }}>
                                <Typography variant="caption" color="text.secondary">
                                    📍 {[info.district, info.province].filter(Boolean).join(' - ') || '---'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">📅 Đơn cuối: {formatDate(info.last_order_date)}</Typography>
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