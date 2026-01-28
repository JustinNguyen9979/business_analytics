import React, { useState } from 'react';
import { 
    TableRow, TableCell, IconButton, Collapse, Box, Grid, 
    Typography, TableContainer, Table, TableHead, TableBody, 
    Paper, Stack, Divider, Chip, Tooltip, useTheme
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PaymentIcon from '@mui/icons-material/Payment';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

import { formatCurrency, formatDate } from '../../utils/formatters';
import OrderStatusChip from '../common/OrderStatusChip';

const OrderRow = ({ order }) => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const theme = useTheme();
    
    const details = order.details || {};
    const items = details.items || [];
    const hasItems = items.length > 0;

    const handleCopy = (text) => {
        if (!text) return;
        navigator.clipboard.writeText(text)
            .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            })
            .catch(err => console.error('Lỗi khi copy:', err));
    };

    // Parse date
    let dateStr = '---';
    let timeStr = '---';
    if (order.order_date) {
        try {
            const dateObj = new Date(order.order_date);
            if (!isNaN(dateObj.getTime())) {
                dateStr = dateObj.toLocaleDateString('vi-VN');
                timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            }
        } catch (e) {
            console.error("Error parsing date:", order.order_date);
        }
    }

    return (
        <React.Fragment>
            {/* Main Row */}
            <TableRow hover sx={{ '& > *': { borderBottom: 'unset' }, bgcolor: open ? 'action.hover' : 'inherit' }}>
                <TableCell>
                    <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontWeight: 500 }}>{order.order_code}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{order.tracking_id || '---'}</TableCell>
                <TableCell>{dateStr}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>{timeStr}</TableCell>
                <TableCell>
                    <OrderStatusChip status={order.status} category={order.category} />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.light' }}>
                    {formatCurrency(order.net_revenue || 0)}
                </TableCell>
                <TableCell sx={{ maxWidth: 150 }}>
                    <Tooltip title={details.cancel_reason || '---'} arrow placement="top">
                        <Typography noWrap variant="body2" sx={{ fontSize: 'inherit', cursor: 'help' }}>
                            {details.cancel_reason || '---'}
                        </Typography>
                    </Tooltip>
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize', color: 'text.secondary' }}>{order.source}</TableCell>
            </TableRow>

            {/* Collapsible Detail Row */}
            <TableRow>
                <TableCell style={{ padding: '10px' }} colSpan={9}>
                    <Collapse in={open} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 3, bgcolor: 'background.default', borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                            <Stack spacing={3}>
                                {/* 1. TOP: Product List (FULL WIDTH) */}
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                                        <Inventory2Icon fontSize="small" color="primary" />
                                        <Typography variant="subtitle2" fontWeight="800" color="primary.main">
                                            DANH SÁCH SẢN PHẨM TRONG ĐƠN ({items.length})
                                        </Typography>
                                    </Box>
                                    {hasItems ? (
                                        <TableContainer sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                                                        <TableCell sx={{ fontWeight: 'bold' }}>Tên Sản Phẩm</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Giá Gốc</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Số Lượng</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Trợ Giá</TableCell>
                                                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Thành tiền</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {items.map((item, index) => (
                                                        <TableRow key={index} hover>
                                                            <TableCell sx={{ fontFamily: 'monospace', color: 'primary.light' }}>{item.sku}</TableCell>
                                                            <TableCell>
                                                                <Typography variant="body2">{item.product_name || item.name || '---'}</Typography>
                                                            </TableCell>
                                                            <TableCell align="right">{formatCurrency(item.original_price || 0)}</TableCell>
                                                            <TableCell align="right">{item.quantity}</TableCell>
                                                            <TableCell align="right">{formatCurrency(item.subsidy_amount || 0)}</TableCell>
                                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                                                {formatCurrency((item.original_price * item.quantity) - (item.subsidy_amount || 0))}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography variant="body2" fontStyle="italic" color="text.secondary">Không có dữ liệu sản phẩm chi tiết</Typography>
                                    )}
                                </Box>

                                {/* 2. BOTTOM: Logistics & Finance (Dynamic Height with Box & Flex) */}
                                <Box sx={{ display: 'flex', gap: 3, width: '100%', flexWrap: 'wrap' }}>
                                    {/* Logistics */}
                                    <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '45%' } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                                            <LocalShippingIcon fontSize="small" color="info" />
                                            <Typography variant="subtitle2" fontWeight="bold">VẬN CHUYỂN & THANH TOÁN</Typography>
                                        </Box>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', height: 'auto' }}>
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h7" color="text.secondary">Đơn vị vận chuyển</Typography>
                                                    <Typography variant="body2" fontWeight="bold">{details.shipping_provider_name || '---'}</Typography>
                                                </Box>
                                                <Divider />
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h7" color="text.secondary">Ngày nhận hàng</Typography>
                                                    <Typography variant="body2" fontWeight="bold">
                                                        {details.delivered_date ? formatDate(details.delivered_date) : 'Đang cập nhật'}
                                                    </Typography>
                                                </Box>
                                                <Divider />
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h7" color="text.secondary">Phương thức thanh toán</Typography>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <PaymentIcon sx={{ fontSize: 14 }} />
                                                        <Typography variant="body2" fontWeight="bold">{details.payment_method || '---'}</Typography>
                                                    </Box>
                                                </Box>
                                                <Divider />
                                                {order.return_tracking_code && (order.category === 'refunded' || (order.status && order.status.toLowerCase().includes('hoan'))) ? (
                                                    <Box sx={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: 1,
                                                        p: 1.5, 
                                                        borderRadius: 2, 
                                                        border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                                        bgcolor: alpha(theme.palette.error.main, 0.03)
                                                    }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Typography variant="h7" color="text.secondary">Trạng thái đơn</Typography>
                                                            <OrderStatusChip 
                                                                status={details.order_status || order.status} 
                                                                variant="chip"
                                                            />
                                                        </Box>
                                                        <Divider sx={{ borderStyle: 'dashed', opacity: 0.5, my: 0.5 }} />
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <AssignmentReturnIcon fontSize="small" color="error" />
                                                                <Typography variant="subtitle2" color="error.main" fontWeight="bold" sx={{ whiteSpace: 'nowrap' }}>MÃ ĐƠN HOÀN</Typography>
                                                            </Box>
                                                            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" fontWeight="bold" color="error.dark" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                                                    {order.return_tracking_code}
                                                                </Typography>
                                                                <Tooltip title={copied ? "Đã sao chép" : "Sao chép mã đơn"}>
                                                                    <IconButton 
                                                                        size="small" 
                                                                        sx={{ p: 0.5, color: copied ? 'success.main' : 'error.main' }}
                                                                        onClick={() => handleCopy(order.return_tracking_code)}
                                                                    >
                                                                        {copied ? <CheckCircleIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Stack>
                                                        </Box>
                                                    </Box>
                                                ) : (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Typography variant="h7" color="text.secondary">Trạng thái đơn</Typography>
                                                        <OrderStatusChip 
                                                            status={details.order_status || order.status} 
                                                            variant="chip"
                                                        />
                                                    </Box>
                                                )}
                                            </Stack>
                                        </Paper>
                                    </Box>

                                    {/* Finance */}
                                    <Box sx={{ flex: 1, minWidth: { xs: '100%', md: '45%' } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5, gap: 1 }}>
                                            <MonetizationOnIcon fontSize="small" color="success" />
                                            <Typography variant="subtitle2" fontWeight="bold">CHI TIẾT TÀI CHÍNH</Typography>
                                        </Box>
                                        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(0, 229, 255, 0.02)', height: 'auto' }}>
                                            <Stack spacing={2}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h7" color="text.secondary">Tổng giá trị đơn (GMV)</Typography>
                                                    <Typography variant="body2" fontWeight="medium">{formatCurrency(order.gmv)}</Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <Typography variant="h7" color="text.secondary">Tổng Chi Phí</Typography>
                                                    <Typography variant="body2" color="error.main" fontWeight="medium">{formatCurrency(order.total_fees || 0)}</Typography>
                                                </Box>
                                                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                                                    <Divider sx={{ width: '100%' }} />
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pt: 1 }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="primary.main" fontWeight="800">DOANH THU ĐƠN HÀNG</Typography>
                                                        <Typography variant="h7" color="text.secondary"></Typography>
                                                    </Box>
                                                    <Typography variant="h5" color="primary.main" fontWeight="900">
                                                        {formatCurrency(order.net_revenue)}
                                                    </Typography>
                                                </Box>
                                            </Stack>
                                        </Paper>
                                    </Box>
                                </Box>
                            </Stack>
                        </Box>
                    </Collapse>
                </TableCell>
            </TableRow>
        </React.Fragment>
    );
};

export default OrderRow;