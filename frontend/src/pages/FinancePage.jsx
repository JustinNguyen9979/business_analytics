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
import { useBrand } from '../context/BrandContext';

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
    const { id: brandId } = useBrand();
    
    const [dateRange, setDateRange] = useState(defaultDateRange);
    const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);
    
    const { currentData, previousData, loading, error } = useFinanceData(brandId, dateRange);

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
    const summaryData = currentData?.find(item => item.platform === 'Tổng cộng') || {};
    const prevSummaryData = previousData?.find(item => item.platform === 'Tổng cộng') || {};
    const platformData = currentData
        ?.filter(item => item.platform !== 'Tổng cộng')
        .sort((a, b) => (b.netRevenue || 0) - (a.netRevenue || 0)) || [];

    // const kpiCards = [
    //     { 
    //         title: 'Tổng Lợi nhuận', 
    //         value: summaryData.profit, 
    //         previousValue: prevSummaryData.profit,
    //         icon: <MonetizationOnIcon />, 
    //         color: 'success.main',
    //         format: 'currency',
    //         direction: 'up',
    //     },
    //     { 
    //         title: 'Tổng GMV', 
    //         value: summaryData.gmv, 
    //         previousValue: prevSummaryData.gmv,
    //         icon: <AccountBalanceWalletIcon />, 
    //         color: 'primary.main',
    //         format: 'currency',
    //         direction: 'up',
    //     },
    //     { 
    //         title: 'Tổng Doanh thu thuần', 
    //         value: summaryData.netRevenue, 
    //         previousValue: prevSummaryData.netRevenue,
    //         icon: <TrendingUpIcon />, 
    //         color: 'info.main',
    //         format: 'currency',
    //         direction: 'up',
    //     },
    //     { 
    //         title: 'Tổng Chi phí', 
    //         value: summaryData.totalCost, 
    //         previousValue: prevSummaryData.totalCost,
    //         icon: <AttachMoneyIcon />, 
    //         color: 'error.main',
    //         format: 'currency',
    //         direction: 'down', // Chi phí giảm là tốt
    //     },
    //     { 
    //         title: 'ROI Tổng', 
    //         value: summaryData.roi, 
    //         previousValue: prevSummaryData.roi,
    //         icon: <StackedLineChartIcon />, 
    //         color: 'secondary.main',
    //         format: 'percent',
    //         direction: 'up',
    //     },
    // ];

    const cardConfigs = [
        { key: 'profit', title: 'Tổng Lợi nhuận', icon: <MonetizationOnIcon />, color: 'success.main' },
        { key: 'gmv', title: 'Tổng GMV', icon: <AccountBalanceWalletIcon />, color: 'primary.main' },
        { key: 'netRevenue', title: 'Tổng Doanh thu thuần', icon: <TrendingUpIcon />, color: 'info.main' },
        { key: 'totalCost', title: 'Tổng Chi phí', icon: <AttachMoneyIcon />, color: 'error.main', direction: 'down' }, // Chi phí giảm là tốt
        { key: 'roi', title: 'ROI Tổng', icon: <StackedLineChartIcon />, color: 'secondary.main', format: 'percent' },
    ];

    // 2. Tạo danh sách kpiCards bằng cách map qua cấu hình và gán dữ liệu động
    const kpiCards = cardConfigs.map(config => ({
        ...config, // Kế thừa toàn bộ thuộc tính static (title, icon, color...)
        value: summaryData[config.key],
        previousValue: prevSummaryData[config.key],
        format: config.format || 'currency', // Mặc định là 'currency' nếu không khai báo
        direction: config.direction || 'up',   // Mặc định là 'up' nếu không khai báo
    }));

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
                        <Box key={index} sx={{ flex: 1, minWidth: '200px' }}>
                            <KpiCardSkeleton />
                        </Box>
                      ))
                    : kpiCards.map(card => (
                        <Box key={card.title} sx={{ flex: 1, minWidth: '200px' }}>
                            <KpiCard 
                                title={card.title} 
                                value={card.value} 
                                icon={card.icon} 
                                color={card.color}
                                previousValue={card.previousValue}
                                format={card.format}
                                direction={card.direction}
                            />
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