import React from 'react';
import { 
    Box, Typography, Grid, Stack, Button, Divider, Avatar, 
    Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, IconButton, Chip 
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';

// Custom Components
import { LuxuryCard, CardHeader, CardContent } from '../StyledComponents';
import OrderStatusChip from '../common/OrderStatusChip';
import { LabelValue, SectionTitle } from './SearchCommon';

// Utils
import { formatCurrency, formatNumber } from '../../utils/formatters';

const OrderResultView = ({ data }) => {
    const theme = useTheme();

    return (
        <Grid container spacing={3} sx={{ animation: 'fadeIn 0.5s ease' }}>
            {/* COL 1: CUSTOMER & INFO (30% -> 25%) */}
            <Grid item xs={12} md={3}>
                <Stack spacing={3}>
                    {/* LUXURY CUSTOMER BOX */}
                    <LuxuryCard sx={{ height: 'auto' }}>
                        <CardHeader>
                            <Typography variant="subtitle1" fontWeight="bold">KHÁCH HÀNG</Typography>
                            <Button size="small" variant="text" endIcon={<VerifiedUserIcon fontSize="small" />}>Chi tiết</Button>
                        </CardHeader>
                        <Box sx={{ p: 3, textAlign: 'center', background: 'linear-gradient(180deg, rgba(0,229,255,0.05) 0%, rgba(0,0,0,0) 100%)' }}>
                            <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, border: `2px solid ${theme.palette.primary.main}` }}>{data.customer.name.charAt(0)}</Avatar>
                            <Typography variant="h6" fontWeight="bold">{data.customer.name}</Typography>
                            <Chip label={data.customer.rank} color="secondary" size="small" sx={{ mt: 1, fontWeight: 'bold' }} />
                        </Box>
                        <Divider />
                        <CardContent>
                            <LabelValue icon={<LocalPhoneIcon />} label="Điện thoại" value={data.customer.phone} isLink />
                            <LabelValue icon={<EmailIcon />} label="Email" value={data.customer.email} />
                            <LabelValue icon={<PlaceIcon />} label="Địa chỉ giao hàng" value={data.customer.fullAddress} />
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                "Khách này thường mua đồ size L, thích giao hàng giờ hành chính."
                            </Typography>
                        </CardContent>
                    </LuxuryCard>

                    {/* OPERATION BOX */}
                    <LuxuryCard sx={{ height: 'auto' }}>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">VẬN HÀNH</Typography></CardHeader>
                        <CardContent>
                            <LabelValue icon={<StorefrontIcon />} label="Nguồn đơn" value={data.source} />
                            <LabelValue icon={<CreditCardIcon />} label="Thanh toán" value={data.paymentMethod} />
                            <Divider sx={{ my: 2, borderStyle: 'dashed' }} />
                            <LabelValue icon={<LocalShippingIcon />} label="Đơn vị vận chuyển" value={data.carrier} />
                            <Box sx={{ p: 1.5, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1, border: `1px dashed ${theme.palette.warning.main}` }}>
                                <Typography variant="caption" color="warning.main" display="block">TRACKING CODE</Typography>
                                <Stack direction="row" alignItems="center" justifyContent="space-between">
                                    <Typography variant="subtitle2" fontWeight="bold">{data.trackingCode}</Typography>
                                    <IconButton size="small"><ContentCopyIcon fontSize="small" /></IconButton>
                                </Stack>
                            </Box>
                        </CardContent>
                    </LuxuryCard>
                </Stack>
            </Grid>

            {/* COL 2: FINANCIAL & ITEMS (65% -> 75%) */}
            <Grid item xs={12} md={9}>
                <Stack spacing={3}>
                    {/* ORDER STATUS BAR */}
                    <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                            <Typography variant="h5" fontWeight="900" color="primary">#{data.id}</Typography>
                            <Divider orientation="vertical" flexItem />
                            
                            {/* Status & Return Code Combined Box */}
                            {data.return_tracking_code && data.status === 'refunded' ? (
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
                                    bgcolor: alpha(theme.palette.error.main, 0.05),
                                    borderRadius: 2,
                                    px: 1, py: 0.5
                                }}>
                                    <OrderStatusChip status={data.status} />
                                    <Divider orientation="vertical" flexItem sx={{ mx: 1.5, bgcolor: alpha(theme.palette.error.main, 0.3) }} />
                                    <Stack direction="row" alignItems="center" spacing={1}>
                                        <AssignmentReturnIcon fontSize="small" color="error" />
                                        <Typography variant="body2" fontWeight="bold" color="error.main">
                                            {data.return_tracking_code}
                                        </Typography>
                                        <IconButton size="small" sx={{ p: 0.5 }}><ContentCopyIcon fontSize="small" /></IconButton>
                                    </Stack>
                                </Box>
                            ) : (
                                <OrderStatusChip status={data.status} />
                            )}

                            <Divider orientation="vertical" flexItem />
                            <Typography variant="body2" color="text.secondary">Tạo lúc: {data.createdDate}</Typography>
                        </Box>
                        <Button variant="outlined" startIcon={<EditIcon />}>Cập nhật</Button>
                    </Paper>

                    {/* ITEM TABLE */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">CHI TIẾT ĐƠN HÀNG</Typography></CardHeader>
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow sx={{ '& th': { color: 'text.secondary', fontWeight: 600 } }}>
                                        <TableCell>Sản phẩm</TableCell>
                                        <TableCell align="center">SL</TableCell>
                                        <TableCell align="right">Đơn giá</TableCell>
                                        <TableCell align="right">Thành tiền</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {data.items.map((item, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="500">{item.name}</Typography>
                                                <Typography variant="caption" color="text.secondary">{item.sku}</Typography>
                                            </TableCell>
                                            <TableCell align="center">{item.qty}</TableCell>
                                            <TableCell align="right">{formatNumber(item.price)}</TableCell>
                                            <TableCell align="right" sx={{ fontWeight: 'bold' }}>{formatNumber(item.total)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </LuxuryCard>

                    {/* P&L ANALYSIS */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">PHÂN TÍCH LỢI NHUẬN (P&L)</Typography></CardHeader>
                        <CardContent>
                            <Grid container spacing={4}>
                                <Grid item xs={12} md={6}>
                                    <SectionTitle>DOANH THU & THU KHÁCH</SectionTitle>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography color="text.secondary">Tổng tiền hàng</Typography>
                                        <Typography>{formatNumber(data.subtotal)}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography color="text.secondary">Voucher/Giảm giá</Typography>
                                        <Typography color="error.main">-{formatNumber(data.discountVoucher)}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography color="text.secondary">Phí ship thu khách</Typography>
                                        <Typography>+{formatNumber(data.shippingFeeCustomer)}</Typography>
                                    </Box>
                                    <Divider sx={{ my: 1.5 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography fontWeight="bold">KHÁCH CẦN TRẢ</Typography>
                                        <Typography variant="h6" fontWeight="bold" color="primary.main">{formatCurrency(data.totalCollected)}</Typography>
                                    </Box>
                                </Grid>

                                <Grid item xs={12} md={6} sx={{ borderLeft: `1px dashed ${theme.palette.divider}`, pl: 4 }}>
                                    <SectionTitle>CHI PHÍ & LỢI NHUẬN (ADMIN ONLY)</SectionTitle>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Giá vốn (COGS)</Typography>
                                        <Typography variant="body2" color="text.primary">-{formatNumber(data.cogs)}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Chi phí vận hành (Ship+Sàn+Ads)</Typography>
                                        <Typography variant="body2" color="warning.main">
                                            -{formatNumber(data.shippingCostReal + data.platformFee + data.adsCost)}
                                        </Typography>
                                    </Box>
                                    <Divider sx={{ my: 1.5 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography fontWeight="bold">LỢI NHUẬN RÒNG</Typography>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="h5" fontWeight="900" color="success.main">+{formatCurrency(data.netProfit)}</Typography>
                                            <Chip label={`Margin: ${data.netMargin}%`} size="small" color="success" sx={{ height: 20 }} />
                                        </Box>
                                    </Box>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </LuxuryCard>
                </Stack>
            </Grid>
        </Grid>
    );
};

export default OrderResultView;