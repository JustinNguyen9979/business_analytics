import React from 'react';
import { 
    Box, Typography, Stack, Button, Divider, 
    Paper, IconButton, Chip 
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import AssignmentReturnIcon from '@mui/icons-material/AssignmentReturn';
import CustomerProfileCard from '../customer/CustomerProfileCard'; 
import OrderItemsTable from '../common/OrderItemsTable';

// Custom Components
import { LuxuryCard, CardHeader, CardContent } from '../StyledComponents';
import OrderStatusChip from '../common/OrderStatusChip';
import { LabelValue, SectionTitle } from './SearchCommon';

// Utils
import { formatCurrency, formatNumber } from '../../utils/formatters';

const OrderResultView = ({ data }) => {
    const theme = useTheme();

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 3,
            animation: 'fadeIn 0.5s ease' 
        }}>
            {/* COL 1: CUSTOMER & INFO (Sidebar) */}
            <Box sx={{ 
                flex: { xs: '1 1 auto', md: '0 0 380px' },
                minWidth: 0
            }}>
                <Stack spacing={3}>
                    {/* LUXURY CUSTOMER BOX */}
                    <Box sx={{ width: '100%' }}>
                        <CustomerProfileCard data={data} />
                    </Box>

                    {/* OPERATION BOX */}
                </Stack>
            </Box>

            {/* COL 2: FINANCIAL & ITEMS (Main Content) */}
            <Box sx={{ 
                flex: 1,
                minWidth: 0
            }}>
                <Stack spacing={3}>
                    <LuxuryCard sx={{ height: 'auto' }}>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">VẬN HÀNH</Typography></CardHeader>
                        <CardContent>
                            <Stack spacing={3}>
                                {/* SECTION 1: TIMELINE (3 KEY MILESTONES) */}
                                <Stack 
                                    direction={{ xs: 'column', sm: 'row' }}
                                    divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, my: 1 }} />}
                                    spacing={2}
                                    sx={{ 
                                        bgcolor: alpha(theme.palette.primary.main, 0.03),
                                        p: 2,
                                        borderRadius: 2,
                                        border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                                        justifyContent: 'space-around',
                                        alignItems: 'center'
                                    }}
                                >
                                    {/* Milestone 1: Created */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5} fontWeight="bold">NGÀY ĐẶT HÀNG</Typography>
                                        <Typography variant="body2" fontWeight="bold">{data.createdDate || '---'}</Typography>
                                    </Box>

                                    {/* Milestone 2: Shipped */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5} fontWeight="bold">GỬI HÀNG</Typography>
                                        <Typography variant="body2" fontWeight="bold" color={data.shippedDate ? 'text.primary' : 'text.disabled'}>
                                            {data.shippedDate || '---'}
                                        </Typography>
                                    </Box>

                                    {/* Milestone 3: Delivered */}
                                    <Box sx={{ textAlign: 'center', flex: 1 }}>
                                        <Typography variant="caption" color="text.secondary" display="block" mb={0.5} fontWeight="bold">NHẬN HÀNG</Typography>
                                        <Typography variant="body2" fontWeight="bold" color={data.deliveredDate ? 'success.main' : 'text.disabled'}>
                                            {data.deliveredDate || '---'}
                                        </Typography>
                                    </Box>
                                </Stack>

                                <Divider />

                                {/* SECTION 2: DETAILS */}
                                <Stack spacing={2}>
                                    {/* Row 1: 3 Metrics (Source, Payment, Carrier) - Horizontal Layout */}
                                    <Box sx={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, 
                                        gap: 2 
                                    }}>
                                        {[
                                            { icon: <StorefrontIcon fontSize="small" />, label: 'Nguồn đơn', value: data.source },
                                            { icon: <CreditCardIcon fontSize="small" />, label: 'Thanh toán', value: data.paymentMethod },
                                            { icon: <LocalShippingIcon fontSize="small" />, label: 'Đơn vị vận chuyển', value: data.carrier }
                                        ].map((item, idx) => (
                                            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                                                    {item.icon}
                                                </Box>
                                                <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                                                    {item.label}:
                                                </Typography>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {item.value}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>

                                    {/* Row 2: Tracking Codes (Order & Return) */}
                                    <Box sx={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, 
                                        gap: 2 
                                    }}>
                                        {/* Tracking Code (Forward) */}
                                        <Box sx={{ 
                                            p: 1.5, 
                                            bgcolor: alpha(theme.palette.info.main, 0.05), 
                                            borderRadius: 2, 
                                            border: `1px dashed ${theme.palette.info.main}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between'
                                        }}>
                                            <Typography variant="subtitle2" color="info.main" fontWeight="900" sx={{ letterSpacing: 0.5 }}>
                                                MÃ VẬN ĐƠN
                                            </Typography>
                                            
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Typography variant="body1" fontWeight="bold">
                                                    {data.trackingCode || '---'}
                                                </Typography>
                                                <IconButton size="small" color="info"><ContentCopyIcon fontSize="small" /></IconButton>
                                            </Stack>
                                        </Box>

                                        {/* Return Tracking Code (Only if exists) */}
                                        {data.return_tracking_code && (
                                            <Box sx={{ 
                                                p: 1.5, 
                                                bgcolor: alpha(theme.palette.error.main, 0.05), 
                                                borderRadius: 2, 
                                                border: `1px dashed ${theme.palette.error.main}`,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between'
                                            }}>
                                                <Typography variant="subtitle2" color="error.main" fontWeight="900" sx={{ letterSpacing: 0.5 }}>
                                                    MÃ HOÀN HÀNG
                                                </Typography>
                                                
                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                    <Typography variant="body1" fontWeight="bold" color="error.main">
                                                        {data.return_tracking_code}
                                                    </Typography>
                                                    <IconButton size="small" color="error"><ContentCopyIcon fontSize="small" /></IconButton>
                                                </Stack>
                                            </Box>
                                        )}
                                    </Box>
                                </Stack>
                            </Stack>
                        </CardContent>
                    </LuxuryCard>
                    

                    {/* ITEM TABLE */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">CHI TIẾT ĐƠN HÀNG</Typography></CardHeader>
                        <Box sx={{ p: 2 }}>
                            <OrderItemsTable items={data.items} />
                        </Box>
                    </LuxuryCard>

                    {/* P&L ANALYSIS */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">PHÂN TÍCH LỢI NHUẬN (P&L)</Typography></CardHeader>
                        <CardContent>
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: { xs: 'column', md: 'row' }, 
                                gap: { xs: 4, md: 0 } 
                            }}>
                                <Box sx={{ flex: 1, pr: { md: 4 } }}>
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
                                </Box>

                                <Box sx={{ 
                                    flex: 1, 
                                    pl: { md: 4 }, 
                                    borderLeft: { md: `1px dashed ${theme.palette.divider}` },
                                    borderTop: { xs: `1px dashed ${theme.palette.divider}`, md: 'none' },
                                    pt: { xs: 4, md: 0 }
                                }}>
                                    <SectionTitle>CHI PHÍ & LỢI NHUẬN (ADMIN ONLY)</SectionTitle>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Giá vốn (COGS)</Typography>
                                        <Typography variant="body2" color="text.primary">-{formatNumber(data.cogs)}</Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Chi phí vận hành (Ship+Sàn+Ads)</Typography>
                                        <Typography variant="body2" color="warning.main">
                                            -{formatNumber((data.shippingCostReal || 0) + (data.platformFee || 0) + (data.adsCost || 0))}
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
                                </Box>
                            </Box>
                        </CardContent>
                    </LuxuryCard>
                </Stack>
            </Box>
        </Box>
    );
};

export default OrderResultView;
