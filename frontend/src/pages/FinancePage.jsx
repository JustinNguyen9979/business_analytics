import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Button, Grid, Skeleton } from '@mui/material';
import { 
    CalendarToday as CalendarTodayIcon,
    MonetizationOn as MonetizationOnIcon,
    TrendingUp as TrendingUpIcon,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    StackedLineChart as StackedLineChartIcon,
    AttachMoney as AttachMoneyIcon // Icon cho Tổng chi phí
} from '@mui/icons-material';
import dayjs from 'dayjs';

import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import FinanceTable from '../components/finance/FinanceTable';
import KpiCard from '../components/dashboard/KpiCard';
import { useFinanceData } from '../hooks/useFinanceData';
import { dateShortcuts } from '../config/dashboardConfig';
import { formatCurrency, formatPercentage } from '../utils/formatters';

// Lấy giá trị mặc định là "Tháng này"
const defaultDateRange = dateShortcuts.find(s => s.type === 'this_month').getValue();
const defaultDateLabel = dateShortcuts.find(s => s.type === 'this_month').label;

// Component cho KpiCard khi đang tải
const KpiCardSkeleton = () => (
    <Paper variant="glass" sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
            <Skeleton variant="text" width={100} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={150} height={40} />
        </Box>
        <Skeleton variant="circular" width={56} height={56} />
    </Paper>
);

function FinancePage() {
    const { brandId } = useParams();
    
    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);
    
    const { data, loading, error } = useFinanceData(brandId, dateRange);

    const handleOpenFilter = (event) => setAnchorEl(event.currentTarget);
    const handleCloseFilter = () => setAnchorEl(null);

    const handleApplyDateRange = (newRange, newLabelType) => {
        const newLabel = dateShortcuts.find(s => s.type === newLabelType)?.label || 
                         `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        setDateRange(newRange);
        setDateLabel(newLabel);
        handleCloseFilter();
    };

    // Tách dữ liệu tổng và chi tiết
    const summaryData = data?.find(item => item.platform === 'Tổng cộng') || {};
    const platformData = data?.filter(item => item.platform !== 'Tổng cộng') || [];

    const kpiCards = [
        { title: 'Tổng Lợi nhuận', value: formatCurrency(summaryData.profit), icon: <MonetizationOnIcon />, color: 'success.main' },
        { title: 'Tổng GMV', value: formatCurrency(summaryData.gmv), icon: <AccountBalanceWalletIcon />, color: 'primary.main' },
        { title: 'Tổng Doanh thu thuần', value: formatCurrency(summaryData.netRevenue), icon: <TrendingUpIcon />, color: 'info.main' },
        { title: 'Tổng Chi phí', value: formatCurrency(summaryData.totalCost), icon: <AttachMoneyIcon />, color: 'error.main' }, // Thêm thẻ Tổng chi phí
        { title: 'ROI Tổng', value: formatPercentage(summaryData.roi), icon: <StackedLineChartIcon />, color: 'secondary.main' },
    ];

    return (
        <Box sx={{ px: 4, py: 3 }}>
            {/* Header: Tiêu đề và Bộ lọc */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                    Báo cáo Tài chính
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<CalendarTodayIcon />}
                    onClick={handleOpenFilter}
                    sx={{ 
                        color: (theme) => theme.palette.primary.main, 
                        borderColor: (theme) => theme.palette.primary.main, 
                        borderRadius: 2 
                    }}
                >
                    {dateLabel}
                </Button>
                <DateRangeFilterMenu
                    open={Boolean(anchorEl)}
                    anchorEl={anchorEl}
                    onClose={handleCloseFilter}
                    initialDateRange={dateRange}
                    onApply={handleApplyDateRange}
                />
            </Box>

            {/* Hàng KPI Cards */}
            <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
                {loading 
                    ? Array.from(new Array(5)).map((_, index) => (
                        <Box key={index} sx={{ flex: 1, minWidth: '180px' }}>
                            <KpiCardSkeleton />
                        </Box>
                      ))
                    : kpiCards.map(card => (
                        <Box key={card.title} sx={{ flex: 1, minWidth: '180px' }}>
                            <KpiCard title={card.title} value={card.value} icon={card.icon} color={card.color} />
                        </Box>
                ))}
            </Box>

            {/* Bảng chi tiết */}
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                Chi tiết theo nền tảng
            </Typography>
            <FinanceTable data={platformData} loading={loading} error={error} />
        </Box>
    );
}

export default FinancePage;