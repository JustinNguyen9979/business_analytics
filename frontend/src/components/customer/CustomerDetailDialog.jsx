import React, { useEffect, useState } from 'react';
import { 
    Dialog, DialogTitle, DialogContent, IconButton, Typography, Box, 
    Grid, Paper, Chip, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Avatar, CircularProgress, Divider, Stack 
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import LocalMallIcon from '@mui/icons-material/LocalMall';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import WarningIcon from '@mui/icons-material/Warning';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { useBrand } from '../../context/BrandContext';
import { fetchCustomerDetailAPI } from '../../services/api';

// --- STYLES ---
const glassStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    color: '#fff'
};

const StatItem = ({ icon, label, value, color }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar sx={{ bgcolor: `${color}20`, color: color, width: 48, height: 48 }}>
            {icon}
        </Avatar>
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>
                {label}
            </Typography>
            <Typography variant="h6" fontWeight="bold">
                {value}
            </Typography>
        </Box>
    </Box>
);

const OrderStatusChip = ({ status }) => {
    let color = 'default';
    let label = status;

    const s = status?.toLowerCase() || '';
    if (s.includes('completed') || s.includes('delivered') || s.includes('thành công')) {
        color = 'success';
        label = 'Thành công';
    } else if (s.includes('cancel') || s.includes('hủy')) {
        color = 'warning';
        label = 'Đã hủy';
    } else if (s.includes('bomb') || s.includes('return') || s.includes('hoàn')) {
        color = 'error';
        label = 'Bom/Hoàn';
    } else {
        color = 'info';
        label = 'Đang xử lý';
    }

    return <Chip label={label} color={color} size="small" variant="filled" sx={{ fontWeight: 'bold' }} />;
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
        } else {
            setData(null);
        }
    }, [open, username, slug]);

    if (!open) return null;

    const info = data?.info || {};
    const orders = data?.orders || [];

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="md" 
            fullWidth
            PaperProps={{
                sx: { 
                    ...glassStyle, 
                    background: '#1e1e2d', // Darker background for readability
                    minHeight: '600px'
                }
            }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pt: 2, pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'left', gap: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 44, height: 44 }}>
                        <PersonIcon />
                    </Avatar>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1.2, textAlign: 'left' }}>
                            Hồ sơ Khách hàng
                        </Typography>
                        <Typography variant="subtitle2" color="primary.light" fontWeight="600" sx={{ textAlign: 'left' }}>
                            @{username}
                        </Typography>
                    </Box>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'text.secondary', mt: -1 }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            
            <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                        <CircularProgress />
                    </Box>
                ) : data ? (
                    <Stack spacing={3}>
                        {/* 1. INFO CARDS */}
                        <Paper sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.2)', borderRadius: 2 }}>
                            <Grid container spacing={3}>
                                <Grid item xs={12} sm={4}>
                                    <StatItem 
                                        icon={<MonetizationOnIcon />} 
                                        label="Tổng Chi Tiêu" 
                                        value={formatCurrency(info.total_spent)} 
                                        color="#00E676" 
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <StatItem 
                                        icon={<LocalMallIcon />} 
                                        label="Tổng Đơn Hàng" 
                                        value={info.total_orders} 
                                        color="#2979FF" 
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <StatItem 
                                        icon={info.bomb_orders > 0 ? <WarningIcon /> : <AccessTimeIcon />} 
                                        label="Uy Tín" 
                                        value={info.bomb_orders > 0 ? `${info.bomb_orders} đơn bom` : "Tốt"} 
                                        color={info.bomb_orders > 0 ? "#FF5252" : "#FFC107"} 
                                    />
                                </Grid>
                            </Grid>
                            
                            <Box sx={{ mt: 2, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                                <Typography variant="body2" color="text.secondary">
                                    📍 Khu vực: <b>{info.city || '---'}</b> - {info.district || '---'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    📅 Đơn cuối: <b>{formatDate(info.last_order_date)}</b>
                                </Typography>
                            </Box>
                        </Paper>

                        {/* 2. ORDER HISTORY TABLE */}
                        <Box>
                            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>Lịch sử Đơn hàng ({orders.length})</Typography>
                            <TableContainer component={Paper} sx={{ bgcolor: 'rgba(0,0,0,0.2)', maxHeight: 400 }}>
                                <Table stickyHeader size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ bgcolor: '#2c2c3a' }}>Mã Đơn</TableCell>
                                            <TableCell sx={{ bgcolor: '#2c2c3a' }}>Ngày đặt</TableCell>
                                            <TableCell sx={{ bgcolor: '#2c2c3a' }}>Trạng thái</TableCell>
                                            <TableCell sx={{ bgcolor: '#2c2c3a' }} align="right">Giá trị</TableCell>
                                            <TableCell sx={{ bgcolor: '#2c2c3a' }}>Nguồn</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {orders.map((order) => (
                                            <TableRow key={order.order_code} hover>
                                                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                    {order.order_code}
                                                </TableCell>
                                                <TableCell>{formatDate(order.order_date)}</TableCell>
                                                <TableCell>
                                                    <OrderStatusChip status={order.status} />
                                                </TableCell>
                                                <TableCell align="right" sx={{ color: 'primary.light', fontWeight: 'bold' }}>
                                                    {formatCurrency(order.gmv || order.selling_price || 0)}
                                                </TableCell>
                                                <TableCell sx={{ textTransform: 'capitalize' }}>
                                                    {order.source}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {orders.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                                                    Chưa có lịch sử đơn hàng
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    </Stack>
                ) : (
                    <Typography color="error">Không tìm thấy dữ liệu.</Typography>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default CustomerDetailDialog;
