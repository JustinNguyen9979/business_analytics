import React from 'react';
import { 
    Box, Typography, Stack
} from '@mui/material';

// Custom Components
import { LuxuryCard, CardHeader, CardContent } from '../StyledComponents';
import OrderHistoryTable from '../customer/OrderHistoryTable';
import CustomerProfileCard from '../customer/CustomerProfileCard'; 

// Utils
import { formatCurrency, formatNumber } from '../../utils/formatters';

const CustomerResultView = ({ data }) => {

    return (
        <Box sx={{ display: 'flex', gap: 3, width: '100%', animation: 'fadeIn 0.5s ease', flexDirection: { xs: 'column', md: 'row' } }}>
            {/* COL 1: LUXURY PROFILE BOX (Fixed Width ~380px) */}
            <Box sx={{ width: { xs: '100%', md: 380 }, flexShrink: 0 }}>
                <CustomerProfileCard data={data} />
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
                            orders={data.recentOrders} 
                            maxHeight={700}
                        />
                    </LuxuryCard>

                    
                </Stack>
            </Box>
        </Box>
    );
};

export default CustomerResultView;