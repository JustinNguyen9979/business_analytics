import React from 'react';
import { 
    Box, Typography, Stack, Divider, Avatar, 
    Paper, Chip, LinearProgress 
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';

// Icons
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WcIcon from '@mui/icons-material/Wc';

// Custom Components
import { LuxuryCard, CardHeader, CardContent } from '../StyledComponents';
import { LabelValue, SectionTitle } from './SearchCommon';
import OrderHistoryTable from '../customer/OrderHistoryTable';

// Utils
import { formatCurrency, formatNumber } from '../../utils/formatters';

const CustomerResultView = ({ data }) => {
    const theme = useTheme();

    return (
        <Box sx={{ display: 'flex', gap: 3, width: '100%', animation: 'fadeIn 0.5s ease', flexDirection: { xs: 'column', md: 'row' } }}>
            {/* COL 1: LUXURY PROFILE BOX (Fixed Width ~380px) */}
            <Box sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0 }}>
                <Stack spacing={3}>
                    <LuxuryCard>
                        <Box sx={{ position: 'relative', height: 120, background: 'linear-gradient(135deg, #00E5FF 0%, #2979FF 100%)', opacity: 0.2 }} />
                        <Box sx={{ px: 3, pb: 4, mt: -6, textAlign: 'center', position: 'relative' }}>
                            <Avatar sx={{ width: 100, height: 100, mx: 'auto', border: `4px solid ${theme.palette.background.paper}`, boxShadow: '0 8px 20px rgba(0,0,0,0.3)' }}>
                                {(data.name || '?').charAt(0)}
                            </Avatar>
                            <Typography variant="h5" fontWeight="bold" sx={{ mt: 2 }}>{data.name || '---'}</Typography>
                            <Box sx={{ mt: 1, display: 'flex', justifyContent: 'center', gap: 1 }}>
                                <Chip label={data.rank} color="primary" sx={{ fontWeight: 'bold' }} />
                                <Chip label={`ID: ${data.id}`} variant="outlined" />
                            </Box>
                            
                            {/* Rank Progress */}
                            <Box sx={{ mt: 3, textAlign: 'left' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                    <Typography variant="caption">Tiến độ lên {data.nextRank}</Typography>
                                    <Typography variant="caption">{data.rankProgress}%</Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={data.rankProgress} sx={{ height: 6, borderRadius: 3 }} />
                            </Box>
                        </Box>
                        
                        <Divider />
                        
                        <CardContent>
                            <SectionTitle>THÔNG TIN LIÊN HỆ</SectionTitle>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <Box sx={{ flex: 1 }}>
                                    <LabelValue icon={<LocalPhoneIcon />} label="Số điện thoại" value={data.phone} isLink />
                                </Box>
                                <Box sx={{ flex: 1 }}>
                                    <LabelValue icon={<WcIcon />} label="Giới tính" value={data.gender} />
                                </Box>
                            </Box>
                            <LabelValue icon={<EmailIcon />} label="Email" value={data.email} />
                            <LabelValue icon={<PlaceIcon />} label="Địa chỉ mặc định" value={data.defaultAddress} />
                            
                            <SectionTitle>GHI CHÚ (NỘI BỘ)</SectionTitle>
                            <Paper sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                                <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                                    <AssignmentIcon sx={{ fontSize: 16, mr: 1, verticalAlign: 'text-bottom' }} />
                                    {data.notes}
                                </Typography>
                                <Stack direction="row" spacing={1} mt={2}>
                                    {(data.tags || []).map(tag => <Chip key={tag} label={tag} size="small" color="info" variant="outlined" />)}
                                </Stack>
                            </Paper>
                        </CardContent>
                    </LuxuryCard>
                </Stack>
            </Box>

            {/* COL 2: METRICS & HISTORY (Flexible Width - Flex 1) */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack spacing={3}>
                    {/* 4 KEY METRICS (Responsive Grid) */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2 }}>
                        {[
                            { label: 'TỔNG CHI TIÊU (LTV)', value: formatCurrency(data.ltv), color: 'primary', isFormatted: true },
                            { label: 'TỔNG LỢI NHUẬN', value: formatCurrency(data.totalProfit), color: 'success', isFormatted: true },
                            { label: 'GIÁ TRỊ TB/ĐƠN', value: formatCurrency(data.aov), color: 'info', isFormatted: true },
                            { label: 'TỔNG ĐƠN HÀNG', value: formatNumber(data.orderCount), color: 'warning', isFormatted: true }
                        ].map((item, idx) => (
                            <LuxuryCard key={idx} sx={{ p: 2.5, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                <Typography variant="caption" color="text.secondary" fontWeight="bold" sx={{ mb: 1 }}>{item.label}</Typography>
                                <Typography variant="h5" fontWeight="bold" color={`${item.color}.main`}>
                                    {item.value}
                                </Typography>
                            </LuxuryCard>
                        ))}
                    </Box>

                    {/* HISTORY TABLE */}
                    <LuxuryCard sx={{ flex: 1 }}>
                        <CardHeader>
                            <Typography variant="subtitle1" fontWeight="bold">LỊCH SỬ ĐƠN HÀNG</Typography>
                        </CardHeader>
                        <OrderHistoryTable 
                            orders={data.recentOrders.map(o => ({
                                order_code: o.id,
                                tracking_id: o.trackingCode, 
                                return_tracking_code: o.return_tracking_code, // Map thêm Return Tracking Code
                                order_date: o.date,
                                status: o.status,
                                category: o.category,
                                net_revenue: o.total,
                                gmv: o.gmv,             // Map thêm GMV
                                total_fees: o.total_fees, // Map thêm Total Fees
                                source: o.source || '---',
                                details: o.details || {} // Truyền full details (items, shipping...)
                            }))} 
                            maxHeight={600}
                        />
                    </LuxuryCard>

                    {/* RISK & STATS */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
                        <LuxuryCard>
                            <CardHeader><Typography variant="subtitle1" fontWeight="bold">CHỈ SỐ RỦI RO</Typography></CardHeader>
                            <CardContent>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                                    <Typography>Số lần hoàn hàng</Typography>
                                    <Typography fontWeight="bold" color="success.main">{data.refundedOrders} lần (Rất tốt)</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <Typography>Số lần hủy đơn</Typography>
                                    <Typography fontWeight="bold" color="warning.main">{data.cancelCount} lần</Typography>
                                </Box>
                            </CardContent>
                        </LuxuryCard>
                    </Box>
                </Stack>
            </Box>
        </Box>
    );
};

export default CustomerResultView;