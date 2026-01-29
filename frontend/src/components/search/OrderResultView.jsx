import React from 'react';
import { 
    Box, Typography, Stack, Divider, 
    IconButton, Chip, Tooltip 
} from '@mui/material';
import { useTheme, alpha, styled } from '@mui/material/styles';

// Icons
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Common & Custom Components
import CustomerProfileCard from '../customer/CustomerProfileCard'; 
import OrderItemsTable from '../common/OrderItemsTable';
import { LuxuryCard, CardHeader, CardContent } from '../StyledComponents';
import { SectionTitle } from './SearchCommon';

// Utils
import { formatCurrency, formatNumber } from '../../utils/formatters';

// --- LOCAL STYLED COMPONENTS ---

const StyledTimelineBox = styled(Stack)(({ theme }) => ({
    backgroundColor: alpha(theme.palette.primary.main, 0.03),
    padding: theme.spacing(2),
    borderRadius: theme.shape.borderRadius * 2,
    border: `1px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
    justifyContent: 'space-around',
    alignItems: 'center'
}));

const TrackingContainer = styled(Box, {
    shouldForwardProp: (prop) => prop !== 'colorType'
})(({ theme, colorType = 'info' }) => {
    const color = theme.palette[colorType].main;
    return {
        padding: theme.spacing(1.5),
        backgroundColor: alpha(color, 0.05),
        borderRadius: theme.shape.borderRadius,
        border: `1px dashed ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'transform 0.2s',
        '&:hover': {
            backgroundColor: alpha(color, 0.1),
        }
    };
});

// --- HELPER SUB-COMPONENTS ---

const MilestoneStep = ({ label, date, isCompleted, color = 'text.primary' }) => (
    <Box sx={{ textAlign: 'center', flex: 1 }}>
        <Typography variant="caption" color="text.secondary" display="block" mb={0.5} fontWeight="bold" sx={{ textTransform: 'uppercase' }}>
            {label}
        </Typography>
        <Typography variant="body2" fontWeight="bold" color={isCompleted ? color : 'text.disabled'}>
            {date || '---'}
        </Typography>
    </Box>
);

const MetricItem = ({ icon, label, value }) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
            {React.cloneElement(icon, { fontSize: 'small' })}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {label}:
        </Typography>
        <Typography variant="body2" fontWeight="bold">
            {value}
        </Typography>
    </Box>
);

const FinanceRow = ({ label, value, valueColor = 'text.primary', isBold = false, isNegative = false, isPositive = false }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography 
            variant={isBold ? 'subtitle2' : 'body2'} 
            fontWeight={isBold ? 'bold' : 'normal'}
            color={valueColor}
        >
            {isNegative && '-'}{isPositive && '+'}{value}
        </Typography>
    </Box>
);

const TrackingInfo = ({ label, code, colorType = 'info' }) => {
    if (!code) return null;
    return (
        <TrackingContainer colorType={colorType}>
            <Typography variant="subtitle2" color={`${colorType}.main`} fontWeight="900" sx={{ letterSpacing: 0.5 }}>
                {label}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body1" fontWeight="bold" color={colorType === 'error' ? 'error.main' : 'text.primary'}>
                    {code}
                </Typography>
                <Tooltip title="Sao chép">
                    <IconButton 
                        size="small" 
                        color={colorType}
                        onClick={() => navigator.clipboard.writeText(code)}
                    >
                        <ContentCopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        </TrackingContainer>
    );
};

// --- MAIN COMPONENT ---

const OrderResultView = ({ data }) => {
    const theme = useTheme();

    // Data Helpers
    const totalOpsCost = (data.shippingCostReal || 0) + (data.platformFee || 0) + (data.adsCost || 0);

    return (
        <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 3,
            animation: 'fadeIn 0.5s ease' 
        }}>
            {/* COL 1: CUSTOMER SIDEBAR */}
            <Box sx={{ flex: { xs: '1 1 auto', md: '0 0 380px' }, minWidth: 0 }}>
                <CustomerProfileCard data={data.customer} />
            </Box>

            {/* COL 2: MAIN CONTENT */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack spacing={3}>
                    
                    {/* 1. OPERATIONS CARD */}
                    <LuxuryCard sx={{ height: 'auto' }}>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">VẬN HÀNH</Typography></CardHeader>
                        <CardContent>
                            <Stack spacing={3}>
                                {/* Timeline */}
                                <StyledTimelineBox 
                                    direction={{ xs: 'column', sm: 'row' }}
                                    divider={<Divider orientation="vertical" flexItem sx={{ display: { xs: 'none', sm: 'block' }, my: 1 }} />}
                                    spacing={2}
                                >
                                    <MilestoneStep label="Ngày đặt hàng" date={data.createdDate} isCompleted={true} />
                                    <MilestoneStep label="Gửi hàng" date={data.shippedDate || 'Đang cập nhật'} isCompleted={!!data.shippedDate} />
                                    <MilestoneStep label="Nhận hàng" date={data.deliveredDate || 'Đang cập nhật'} isCompleted={!!data.deliveredDate} color="success.main" />
                                </StyledTimelineBox>

                                <Divider />

                                {/* Order Info Grid */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                                    <MetricItem icon={<StorefrontIcon />} label="Nguồn" value={data.source} />
                                    <MetricItem icon={<CreditCardIcon />} label="Thanh Toán" value={data.paymentMethod} />
                                    <MetricItem icon={<LocalShippingIcon />} label="ĐVVC" value={data.carrier} />
                                </Box>

                                {/* Tracking Codes */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: data.return_tracking_code ? '1fr 1fr' : '1fr' }, gap: 2 }}>
                                    <TrackingInfo label="MÃ VẬN ĐƠN" code={data.trackingCode} colorType="info" />
                                    <TrackingInfo label="MÃ HOÀN HÀNG" code={data.return_tracking_code} colorType="error" />
                                </Box>
                            </Stack>
                        </CardContent>
                    </LuxuryCard>

                    {/* 2. ORDER ITEMS */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">CHI TIẾT ĐƠN HÀNG</Typography></CardHeader>
                        <Box sx={{ p: 2 }}>
                            <OrderItemsTable items={data.items} />
                        </Box>
                    </LuxuryCard>

                    {/* 3. P&L ANALYSIS */}
                    <LuxuryCard>
                        <CardHeader><Typography variant="subtitle1" fontWeight="bold">PHÂN TÍCH LỢI NHUẬN (P&L)</Typography></CardHeader>
                        <CardContent>
                            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: { xs: 4, md: 0 } }}>
                                
                                {/* Client Side (Revenue Breakdown) */}
                                <Box sx={{ flex: 1, pr: { md: 4 } }}>
                                    <SectionTitle>DOANH THU & PHÍ SÀN</SectionTitle>
                                    <FinanceRow label="Giá bán (Original Price)" value={formatNumber(data.original_price)} />
                                    <FinanceRow label="Trợ giá (Voucher/Subsidy)" value={formatNumber(data.subsidy_amount)} isPositive valueColor="success.main" />
                                    <FinanceRow label="Khách trả (Subtotal)" value={formatNumber(data.sku_price)} isBold />
                                    
                                    <Divider sx={{ my: 1.5, borderStyle: 'dashed' }} />
                                    
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center' }}>
                                        <Typography variant="body2" color="text.secondary">Phí sàn & QC (Fees)</Typography>
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            {data.takeRate > 0 && (
                                                <Chip 
                                                    label={`Take Rate: ${formatNumber(data.takeRate)}%`} 
                                                    size="small" 
                                                    color="warning" 
                                                    variant="outlined"
                                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} 
                                                />
                                            )}
                                            <Typography variant="body2" color="error.main">
                                                -{formatNumber(data.totalFees)}
                                            </Typography>
                                        </Stack>
                                    </Box>

                                    <Divider sx={{ my: 1.5 }} />
                                    
                                    <FinanceRow 
                                        label="Thực nhận (Net Revenue)" 
                                        value={formatCurrency(data.netRevenue)} 
                                        isBold 
                                        valueColor="primary.main" 
                                    />
                                </Box>

                                {/* Admin Side (Costs & Profit) */}
                                <Box sx={{ 
                                    flex: 1, 
                                    pl: { md: 4 }, 
                                    borderLeft: { md: `1px dashed ${theme.palette.divider}` },
                                    borderTop: { xs: `1px dashed ${theme.palette.divider}`, md: 'none' },
                                    pt: { xs: 4, md: 0 }
                                }}>
                                    <SectionTitle>HIỆU QUẢ KINH DOANH (NET)</SectionTitle>
                                    <FinanceRow label="Doanh thu thực nhận" value={formatNumber(data.netRevenue)} />
                                    <FinanceRow label="Giá vốn hàng bán (COGS)" value={formatNumber(data.cogs)} isNegative valueColor="error.main" />
                                    
                                    <Divider sx={{ my: 1.5 }} />
                                    
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Typography fontWeight="bold">LỢI NHUẬN RÒNG</Typography>
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Typography variant="h5" fontWeight="900" color={data.netProfit >= 0 ? "success.main" : "error.main"}>
                                                {data.netProfit >= 0 ? '+' : ''}{formatCurrency(data.netProfit)}
                                            </Typography>
                                            <Chip 
                                                label={`Margin: ${formatNumber(data.profitMargin)}%`} 
                                                size="small" 
                                                color={data.profitMargin >= 0 ? "success" : "error"} 
                                                sx={{ height: 20, fontWeight: 'bold', mt: 0.5 }} 
                                            />
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