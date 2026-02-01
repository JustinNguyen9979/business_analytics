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

import { formatCurrency, formatDate, formatNumber } from '../../utils/formatters';
import OrderStatusChip from '../common/OrderStatusChip';

import OrderItemsTable from '../common/OrderItemsTable';
import { ProfitResultBox, FinanceRow } from '../StyledComponents.jsx';

const OrderRow = ({ order, data }) => {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const theme = useTheme();
    
    const details = order.details || {};
    const items = details.items || [];
    const hasItems = items.length > 0;

    // Logic hiển thị mã đơn hoàn (Fix hiển thị 0.0)
    const rawReturnCode = order.order_refund || order.return_tracking_code;
    const displayReturnCode = (rawReturnCode && rawReturnCode !== '0.0' && rawReturnCode !== 0) ? rawReturnCode : '---';

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
            <TableRow hover sx={{ '& > *': { borderBottom: 'none' }, bgcolor: open ? 'action.hover' : 'inherit' }}>
                <TableCell>
                    <IconButton aria-label="expand row" size="small" onClick={() => setOpen(!open)}>
                        {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                    </IconButton>
                </TableCell>
                <TableCell sx={{ 
                    fontFamily: 'monospace', 
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {order.order_code}
                </TableCell>
                <TableCell sx={{ 
                    fontFamily: 'monospace', 
                    color: 'text.secondary',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {order.tracking_id || '---'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{dateStr}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{timeStr}</TableCell>
                <TableCell>
                    <OrderStatusChip status={order.status} category={order.category} />
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.light', whiteSpace: 'nowrap' }}>
                    {formatCurrency(order.net_revenue || 0)}
                </TableCell>
                <TableCell>
                    <Tooltip title={details.cancel_reason || '---'} arrow placement="top">
                        <Typography noWrap variant="body2" sx={{ fontSize: 'inherit', cursor: 'help', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {details.cancel_reason || '---'}
                        </Typography>
                    </Tooltip>
                </TableCell>
            </TableRow>

            {/* Collapsible Detail Row */}
            <TableRow>
                <TableCell style={{ padding: '10px' }} colSpan={8}>
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
                                    <OrderItemsTable items={items} />
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
                                                    <Typography variant="h7" color="text.secondary">Nguồn đơn</Typography>
                                                    <Typography variant="body2" fontWeight="bold">{order.source || '---'}</Typography>
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
                                                {displayReturnCode !== '---' ? (
                                                    <Box sx={{ 
                                                        display: 'flex', 
                                                        flexDirection: 'column', 
                                                        gap: 1,
                                                        p: 1.5, 
                                                        borderRadius: 2, 
                                                        border: `1.5px dashed ${alpha(theme.palette.error.main, 0.4)}`,
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
                                                                    {displayReturnCode}
                                                                </Typography>
                                                                <Tooltip title={copied ? "Đã sao chép" : "Sao chép mã đơn"}>
                                                                    <IconButton 
                                                                        size="small" 
                                                                        sx={{ p: 0.5, color: copied ? 'success.main' : 'error.main' }}
                                                                        onClick={() => handleCopy(displayReturnCode)}
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
                                            <Stack spacing={0}>
                                                {/* Breakdown Doanh Thu & Phí Sàn */}
                                                <FinanceRow label="Giá niêm yết (Original)" value={formatCurrency(order.original_price || 0)} />
                                                
                                                {(order.subsidy_amount > 0 || order.subsidy_amount < 0) && (
                                                    <FinanceRow 
                                                        label="Trợ giá (Subsidy)" 
                                                        value={formatCurrency(Math.abs(order.subsidy_amount || 0))} 
                                                        isNegative 
                                                        valueColor="#f38836" 
                                                    />
                                                )}

                                                <FinanceRow label="Khách trả (Subtotal)" value={formatCurrency(order.sku_price || 0)} isBold />

                                                <Divider sx={{ borderStyle: 'dashed', my: 1, opacity: 0.5 }} />

                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">Phí sàn & QC (Fees)</Typography>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {(!!order.takeRate && Math.abs(order.takeRate) > 0 && order.net_revenue > 0) && (
                                                            <Chip 
                                                                label={`${Math.round(Math.abs(order.takeRate))}%`} 
                                                                size="small" 
                                                                color="warning" 
                                                                variant="outlined"
                                                                sx={{ height: 16, fontSize: '0.6rem', fontWeight: 'bold' }} 
                                                            />
                                                        )}
                                                        <Typography variant="body2" color="error.main">{formatCurrency(order.total_fees || 0)}</Typography>
                                                    </Stack>
                                                </Box>

                                                <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', pb: 1.5 }}>
                                                    <Divider sx={{ width: '100%' }} />
                                                </Box>

                                                {/* Final Net Revenue */}
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                                    <Box>
                                                        <Typography variant="subtitle2" color="primary.main" fontWeight="800">DOANH THU THỰC NHẬN (NET)</Typography>
                                                    </Box>
                                                    <Typography variant="h6" color="primary.main" fontWeight="900">
                                                        {formatCurrency(order.net_revenue || 0)}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                    <Typography variant="body2" color="text.secondary">Giá vốn (COGS)</Typography>
                                                    <Typography variant="body2" color={order.category === 'bomb' ? 'text.primary' : 'error.main'}>
                                                        -{formatCurrency(order.cogs || 0)}
                                                    </Typography>
                                                </Box>

                                                {/* HIỆU QUẢ KINH DOANH (Business Efficiency) */}
                                                <ProfitResultBox isPositive={order.netProfit >= 0}>
                                                    
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <Box>
                                                            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
                                                                Lợi nhuận ròng
                                                            </Typography>
                                                            <Stack direction="row" spacing={0.5} alignItems="center" mt={0.5}>
                                                                <Typography variant="caption" color="text.secondary">Margin:</Typography>
                                                                <Typography variant="body2" fontWeight="bold" color={order.profitMargin >= 0 ? "success.main" : "error.main"}>
                                                                    {formatNumber(order.profitMargin)}%
                                                                </Typography>
                                                            </Stack>
                                                        </Box>
                                                        <Typography variant="h6" fontWeight="900" color={order.netProfit >= 0 ? "success.main" : "error.main"}>
                                                            {order.netProfit > 0 ? '+' : ''}{formatCurrency(order.netProfit || 0)}
                                                        </Typography>
                                                    </Box>
                                                </ProfitResultBox>
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