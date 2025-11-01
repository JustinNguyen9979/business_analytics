import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Box, Grid, Paper, Divider, CircularProgress, Alert, Tabs, Tab, useTheme, useMediaQuery, Button, Menu, MenuItem } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getBrandDetails } from '../services/api';
import { StatItem } from '../components/dashboard/StatItem';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { calculateAllKpis } from '../utils/kpiCalculations';

const reviveDates = (data) => {
    if (!data) return data;
    (data.revenues || []).forEach(item => {
        if (item.transaction_date) item.transaction_date = dayjs(item.transaction_date);
    });
    (data.ads || []).forEach(item => {
        if (item.ad_date) item.ad_date = dayjs(item.ad_date);
    });
    (data.orders || []).forEach(item => {
        if (item.order_date) item.order_date = dayjs(item.order_date);
    });
    return data;
};

const getPreviousPeriod = (startDate, endDate, timeRange) => {
    if (!startDate || !endDate) return [null, null];

    switch (timeRange) {
        case 'today':
            return [startDate.subtract(1, 'day').startOf('day'), endDate.subtract(1, 'day').endOf('day')];
        case 'week':
            return [startDate.subtract(1, 'week').startOf('week'), endDate.subtract(1, 'week').endOf('week')];
        case 'month':
             return [startDate.subtract(1, 'month').startOf('month'), startDate.subtract(1, 'month').endOf('month')];
        case 'year':
            return [startDate.subtract(1, 'year').startOf('year'), startDate.subtract(1, 'year').endOf('year')];
        default: // Xử lý cho khoảng thời gian tùy chỉnh
            const diff = endDate.diff(startDate, 'day');
            const prevEndDate = startDate.subtract(1, 'day').endOf('day');
            const prevStartDate = prevEndDate.subtract(diff, 'day').startOf('day');
            return [prevStartDate, prevEndDate];
    }
};

const ChartPlaceholder = ({ title }) => (
    <Paper variant="placeholder" elevation={0} sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">{title}</Typography>
        <Typography variant="body2" color="text.secondary">(Chức năng đang được phát triển)</Typography>
    </Paper>
);

function DashboardPage() {
    const { brandId } = useParams();
    // === DÒNG SỬA LỖI ĐƯỢC THÊM VÀO ĐÂY ===
    const navigate = useNavigate();
    // ======================================

    const [brand, setBrand] = useState(null);
    const [previousBrandData, setPreviousBrandData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // const [customDateRange, setCustomDateRange] = useState([dayjs().startOf('year'), dayjs()]);

    const [customDateRange, setCustomDateRange] = useState([dayjs().startOf('year'), dayjs()]);
    // State "tạm thời" - chỉ dùng cho giao diện DatePicker
    const [tempDateRange, setTempDateRange] = useState(customDateRange);

    const [timeRange, setTimeRange] = useState('year');

    const theme = useTheme();
    const isCompactLayout = useMediaQuery(theme.breakpoints.down('lg'));
    
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);

    const handleClickMenu = (event) => setAnchorEl(event.currentTarget);
    const handleCloseMenu = () => setAnchorEl(null);

    useEffect(() => {
        setTempDateRange(customDateRange);
    }, [customDateRange]);

    const { currentKpis, previousKpis } = useMemo(() => {
        const currentData = calculateAllKpis(brand, customDateRange);
        // Dùng state `previousBrandData` để tính toán cho kỳ trước
        const previousData = calculateAllKpis(previousBrandData, getPreviousPeriod(customDateRange[0], customDateRange[1], timeRange));
        return { currentKpis: currentData, previousKpis: previousData };
    }, [brand, previousBrandData, customDateRange, timeRange]);

    const handleTimeRangeChange = (event, newValue) => {
        if (!newValue) return;
        let start = dayjs(), end = dayjs();
        switch (newValue) {
            case 'today': start = dayjs().startOf('day'); end = dayjs().endOf('day'); break;
            case 'week': start = dayjs().startOf('week'); end = dayjs().endOf('week'); break;
            case 'month': start = dayjs().startOf('month'); end = dayjs(); break;
            case 'year': start = dayjs().startOf('year'); end = dayjs(); break;
            default: break;
        }
        setTimeRange(newValue);
        setCustomDateRange([start, end]); // Cập nhật state đã xác nhận
        handleCloseMenu();
    };

    const handleAcceptDateChange = (newDateRange) => {
        if (newDateRange[0] && newDateRange[1] && dayjs(newDateRange[0]).isValid() && dayjs(newDateRange[1]).isValid()) {
            setCustomDateRange(newDateRange); // Cập nhật state đã xác nhận
            setTimeRange(null);
        }
    };

    useEffect(() => {
        const fetchDetailsForBothPeriods = async () => {
            if (!brandId || !customDateRange[0] || !customDateRange[1]) return;
            setLoading(true);
            setError(null);
            const [currentStart, currentEnd] = customDateRange;
            const [prevStart, prevEnd] = getPreviousPeriod(currentStart, currentEnd, timeRange);
            try {
                // Sửa lại các dòng gọi API
                const [currentDataResponse, previousDataResponse] = await Promise.all([
                    getBrandDetails(brandId, currentStart, currentEnd), // Xóa timeRange
                    (prevStart && prevEnd) ? getBrandDetails(brandId, prevStart, prevEnd) : Promise.resolve(null) // Xóa timeRange
                ]);
                setBrand(reviveDates(currentDataResponse));
                setPreviousBrandData(reviveDates(previousDataResponse));
            } catch (err) {
                console.error("Lỗi khi fetch chi tiết brand:", err);
                if (err.response && err.response.status === 404) { navigate('/'); } 
                else { setError(`Không thể tải dữ liệu cho brand ID: ${brandId}. Vui lòng thử lại.`); }
            } finally {
                setLoading(false);
            }
        };
        fetchDetailsForBothPeriods();
    }, [brandId, customDateRange, timeRange, navigate]);

    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (!brand) { return null; /* Hoặc có thể trả về một Spinner khác */ }

    const kpiGroups = [
        {
            groupTitle: 'Tài chính',
            items: [
                { key: 'netRevenue', title: 'DOANH THU RÒNG', format: 'currency' },
                { key: 'gmv', title: 'GMV', format: 'currency', tooltipText: 'Gross Merchandise Value - Tổng giá trị hàng hóa đã bán (chưa trừ chi phí).' },
                { key: 'totalCost', title: 'TỔNG CHI PHÍ', format: 'currency', tooltipText: 'Tổng chi phí bao gồm Giá vốn (COGS) và Chi phí Thực thi.', direction: 'down' },
                { key: 'cogs', title: 'GIÁ VỐN (COGS)', format: 'currency', tooltipText: 'Cost of Goods Sold - Chi phí giá vốn hàng bán.' },
                { key: 'executionCost', title: 'CHI PHÍ THỰC THI', format: 'currency', direction: 'down' },
                { key: 'profit', title: 'LỢI NHUẬN GỘP', format: 'currency' },
                { key: 'roi', title: 'ROI (%)', format: 'percent', tooltipText: 'Return on Investment - Tỷ suất lợi nhuận trên tổng chi phí. Công thức: (Lợi nhuận / Tổng chi phí) * 100.' },
                { key: 'profitMargin', title: 'TỶ SUẤT LỢI NHUẬN (%)', format: 'percent', tooltipText: 'Tỷ lệ lợi nhuận so với doanh thu. Công thức: (Lợi nhuận / Doanh thu Ròng) * 100.' },
                { key: 'takeRate', title: 'TAKE RATE (%)', format: 'percent', tooltipText: 'Tỷ lệ phần trăm chi phí thực thi so với GMV. Công thức: (Chi phí Thực thi / GMV) * 100.', direction: 'down' },
            ]
        },
        {
            groupTitle: 'Marketing',
            items: [
                { key: 'adSpend', title: 'CHI PHÍ ADS', format: 'currency' },
                { key: 'roas', title: 'ROAS', format: 'number', tooltipText: 'Return on Ad Spend - Doanh thu trên chi phí quảng cáo. Công thức: Doanh thu từ Ads / Chi phí Ads.' },
                { key: 'cpo', title: 'CPO', format: 'currency', tooltipText: 'Cost Per Order - Chi phí để có được một đơn hàng từ quảng cáo.' },
                { key: 'ctr', title: 'CTR (%)', format: 'percent', tooltipText: 'Click-Through Rate - Tỷ lệ nhấp chuột vào quảng cáo.' },
                { key: 'cpc', title: 'CPC', format: 'currency', tooltipText: 'Cost Per Click - Chi phí cho mỗi lượt nhấp chuột vào quảng cáo.' },
                { key: 'conversionRate', title: 'TỶ LỆ CHUYỂN ĐỔI (%)', format: 'percent' },
            ]
        },
        {
            groupTitle: 'Vận hành',
            items: [
                { key: 'totalOrders', title: 'TỔNG ĐƠN', format: 'number' },
                { key: 'completedOrders', title: 'ĐƠN CHỐT', format: 'number' },
                { key: 'cancelledOrders', title: 'ĐƠN HỦY', format: 'number', direction: 'down' },
                { key: 'refundedOrders', title: 'ĐƠN HOÀN', format: 'number', direction: 'down' },
                { key: 'aov', title: 'AOV', format: 'currency', tooltipText: 'Average Order Value - Giá trị trung bình của một đơn hàng.' },
                { key: 'upt', title: 'UPT', format: 'number', tooltipText: 'Units Per Transaction - Số sản phẩm trung bình trên một đơn hàng.' },
                { key: 'uniqueSkusSold', title: 'SỐ SKU ĐÃ BÁN', format: 'number', tooltipText: 'Số loại sản phẩm khác nhau đã được bán.' },
                { key: 'completionRate', title: 'Tỷ lệ Chốt', format: 'percent', tooltipText: 'Tỷ lệ giữa số đơn chốt và tổng số đơn.' },
                { key: 'refundRate', title: 'TỶ LỆ HOÀN', format: 'percent', direction: 'down' },
                { key: 'cancellationRate', title: 'TỶ LỆ HỦY', format: 'percent', direction: 'down' },
            ]
        },
        {
            groupTitle: 'Khách hàng',
            items: [
                { key: 'totalCustomers', title: 'TỔNG KHÁCH', format: 'number' },
                { key: 'newCustomers', title: 'KHÁCH MỚI', format: 'number' },
                { key: 'returningCustomers', title: 'KHÁCH QUAY LẠI', format: 'number' },
                { key: 'cac', title: 'CAC', format: 'currency', tooltipText: 'Customer Acquisition Cost - Chi phí để có được một khách hàng mới.' },
                { key: 'retentionRate', title: 'TỶ LỆ QL (%)', format: 'percent' },
                { key: 'ltv', title: 'LTV', format: 'currency', tooltipText: 'Customer Lifetime Value - Lợi nhuận trung bình một khách hàng mang lại.' },
            ]
        }
    ];

    const timeOptions = [
        { label: 'Hôm nay', value: 'today' },
        { label: 'Tuần này', value: 'week' },
        { label: 'Tháng này', value: 'month' },
        { label: 'Năm nay', value: 'year' },
    ];
    const selectedOptionLabel = timeOptions.find(opt => opt.value === timeRange)?.label || 'Tùy chỉnh';

    return (
        <Box>
            <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: 700 }}>
                Báo cáo Kinh doanh: {brand.name}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" noWrap>
                        Chỉ số Hiệu suất Tổng thể
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: { xs: 'center', lg: 'flex-end' } }}>
                        <DatePicker
                            label="Từ ngày"
                            value={tempDateRange[0]} // Hiển thị giá trị TẠM THỜI
                            onChange={(date) => setTempDateRange([date, tempDateRange[1]])} // Cập nhật giá trị TẠM THỜI
                            onAccept={(date) => handleAcceptDateChange([date, tempDateRange[1]])} // XÁC NHẬN giá trị cuối cùng
                            onClose={() => setTempDateRange(customDateRange)} // Hủy bỏ thay đổi khi đóng
                            maxDate={tempDateRange[1]}
                            format="DD/MM/YYYY"
                            views={['year', 'month', 'day']}
                            closeOnSelect={false}
                            slotProps={{
                                textField: { sx: { width: 150 } },
                                actionBar: { actions: ['cancel', 'accept'] }
                            }}
                        />

                        <DatePicker
                            label="Đến ngày"
                            value={tempDateRange[1]} // Hiển thị giá trị TẠM THỜI
                            onChange={(date) => setTempDateRange([tempDateRange[0], date])} // Cập nhật giá trị TẠM THỜI
                            onAccept={(date) => handleAcceptDateChange([tempDateRange[0], date])} // XÁC NHẬN giá trị cuối cùng
                            onClose={() => setTempDateRange(customDateRange)} // Hủy bỏ thay đổi khi đóng
                            minDate={tempDateRange[0]}
                            format="DD/MM/YYYY"
                            views={['year', 'month', 'day']}
                            closeOnSelect={false}
                            slotProps={{
                                textField: { sx: { width: 150 } },
                                actionBar: { actions: ['cancel', 'accept'] }
                            }}
                        />
                        
                        {isCompactLayout ? (
                            <>
                                <Button
                                    onClick={handleClickMenu}
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FilterListIcon />}
                                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                                >
                                    {selectedOptionLabel}
                                </Button>
                                <Menu
                                    anchorEl={anchorEl}
                                    open={openMenu}
                                    onClose={handleCloseMenu}
                                    MenuListProps={{ sx: { width: anchorEl?.clientWidth } }}
                                >
                                    {timeOptions.map((option) => (
                                        <MenuItem key={option.value} selected={option.value === timeRange} onClick={(event) => handleTimeRangeChange(event, option.value)}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            </>
                        ) : (
                            <>
                                <Divider orientation="vertical" flexItem />
                                <Tabs 
                                    value={timeRange} 
                                    onChange={handleTimeRangeChange}
                                    variant="standard"
                                    sx={{ minHeight: 'auto', '& .MuiTabs-indicator': { backgroundColor: 'primary.main' }, '& .MuiTab-root': { minHeight: 'auto', minWidth: 'auto', px: 2, py: 0.5, textTransform: 'none', '&.Mui-selected': { color: 'primary.main' } } }}
                                >
                                    {timeOptions.map((option) => (
                                        <Tab key={option.value} label={option.label} value={option.value} />
                                    ))}
                                </Tabs>
                            </>
                        )}
                    </Box>
                </Box>
                <Divider sx={{ mb: 3 }} />
                
                <Box
                    sx={{
                        display: 'grid',
                        // Tự động tạo các cột có chiều rộng tối thiểu 250px
                        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                    }}
                >
                    {kpiGroups.map((group, groupIndex) => (
                        <Box 
                            key={group.groupTitle}
                            sx={{
                                p: 2,
                                // Đường kẻ phải cho các item không phải cuối cùng trên hàng
                                borderRight: {
                                    md: (groupIndex + 1) % 4 !== 0 && groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                    lg: (groupIndex + 1) % 4 !== 0 && groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                },
                                // Đường kẻ dưới cho các item
                                borderBottom: {
                                    xs: groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                    md: groupIndex < 2 ? `1px solid ${theme.palette.divider}` : 'none', // Chỉ kẻ cho 2 hàng đầu tiên trên MD
                                    lg: 'none' // Không kẻ dưới trên LG
                                }
                            }}
                        >
                            <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
                                {group.groupTitle}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                                    gap: 3,
                                    textAlign: 'left'
                                }}
                            >
                                {group.items.map((kpi) => (
                                    <StatItem 
                                        key={kpi.key} 
                                        title={kpi.title} 
                                        value={currentKpis[kpi.key]} 
                                        previousValue={previousKpis[kpi.key]}
                                        format={kpi.format}
                                        tooltipText={kpi.tooltipText}
                                        direction={kpi.direction}
                                    />
                                ))}
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Paper>

            <Grid container spacing={3}>
                <Grid item xs={12} lg={8}>
                    <ChartPlaceholder title="Biểu đồ Doanh thu & Chi phí theo Thời gian" />
                </Grid>
                <Grid item xs={12} lg={4}>
                    <ChartPlaceholder title="Biểu đồ tròn Phân bổ Doanh thu" />
                </Grid>
                 <Grid item xs={12}>
                    <ChartPlaceholder title="Biểu đồ cột Top 10 Sản phẩm Bán chạy" />
                </Grid>
            </Grid>
        </Box>
    );
}

export default DashboardPage;