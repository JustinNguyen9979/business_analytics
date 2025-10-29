import React, { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Box, Grid, Paper, Divider, CircularProgress, Alert, Tabs, Tab, useTheme, useMediaQuery, Button, Menu, MenuItem } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getBrandDetails } from '../services/api';
import { StatItem } from '../components/dashboard/StatItem';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import ImportDialog from "../components/import/ImportDialog";
import SingleImportDialog from "../components/import/SingleImportDialog";
import dayjs from 'dayjs'; 
import 'dayjs/locale/vi';
import { calculateAllKpis } from '../utils/kpiCalculations';

const ChartPlaceholder = ({ title }) => (
    <Paper variant="placeholder" elevation={0}>
        <Typography variant="h6" color="text.secondary">{title}</Typography>
    </Paper>
);

const getPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return [null, null];
    const diff = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.subtract(1, 'day').endOf('day');
    const prevStartDate = prevEndDate.subtract(diff, 'day').startOf('day');
    return [prevStartDate, prevEndDate];
};

function DashboardPage() {
    const { brandId } = useParams();
    const [brand, setBrand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [customDateRange, setCustomDateRange] = useState([null, null]);
    const [timeRange, setTimeRange] = useState('month');
    
    // SỬ DỤNG BREAKPOINT 'lg' (1200px) ĐỂ CÓ NHIỀU KHÔNG GIAN HƠN
    const theme = useTheme();
    const isCompactLayout = useMediaQuery(theme.breakpoints.down('lg'));
    
    const [anchorEl, setAnchorEl] = useState(null);
    const openMenu = Boolean(anchorEl);
    const handleClickMenu = (event) => setAnchorEl(event.currentTarget);
    const handleCloseMenu = () => setAnchorEl(null);

    const { currentKpis, previousKpis } = useMemo(() => {
        if (!brand || !customDateRange[0] || !customDateRange[1]) {
            return { currentKpis: {}, previousKpis: {} };
        }
        
        const currentData = calculateAllKpis(brand, customDateRange);
        
        const previousPeriod = getPreviousPeriod(customDateRange[0], customDateRange[1]);
        const previousData = calculateAllKpis(brand, previousPeriod);

        return { currentKpis: currentData, previousKpis: previousData };
    }, [brand, customDateRange]);

    const handleTimeRangeChange = (event, newValue) => {
        let start = dayjs();
        let end = dayjs();

        switch (newValue) {
            case 'today':
                start = dayjs().startOf('day');
                end = dayjs().endOf('day');
                break;
            case 'week':
                start = dayjs().startOf('week');
                end = dayjs().endOf('week');
                break;
            case 'month':
                start = dayjs().startOf('month');
                // Nếu đang trong tháng hiện tại, ngày kết thúc là hôm nay
                if (dayjs().isSame(start, 'month')) {
                    end = dayjs();
                } else {
                    end = dayjs().endOf('month');
                }
                break;
            case 'year':
                start = dayjs().startOf('year');
                 // Nếu đang trong năm hiện tại, ngày kết thúc là hôm nay
                 if (dayjs().isSame(start, 'year')) {
                    end = dayjs();
                } else {
                    end = dayjs().endOf('year');
                }
                break;
            default:
                break;
        }
        setTimeRange(newValue);
        setCustomDateRange([start, end]); // Cập nhật cả DatePicker
        handleCloseMenu();
    };

    const handleCustomDateChange = (newDateRange) => {
        setCustomDateRange(newDateRange);
        setTimeRange(null); 
        console.log("Custom date range changed to:", newDateRange);
    };

    useEffect(() => {
        handleTimeRangeChange(null, 'month');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const fetchDetails = async () => {
            if (!brandId) { setError("Không tìm thấy Brand ID."); setLoading(false); return; }
            try {
                setLoading(true); setError(null);
                const data = await getBrandDetails(brandId);
                setBrand(data);
            } catch (err) {
                console.error("Lỗi khi fetch chi tiết brand:", err);
                setError(`Không thể tải dữ liệu cho brand ID: ${brandId}. Vui lòng thử lại.`);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [brandId]);

    if (loading) { return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>; }
    if (error) { return <Alert severity="error">{error}</Alert>; }
    if (!brand) { return <Alert severity="warning">Không có dữ liệu cho brand này.</Alert>; }

    const kpiGroups = [
        {
            groupTitle: 'Tài chính',
            items: [
                { key: 'gmv', title: 'DOANH THU (GMV)', format: 'currency', tooltipText: 'Gross Merchandise Value - Tổng giá trị hàng hóa đã bán (chưa trừ chi phí).' },
                { key: 'totalCost', title: 'TỔNG CHI PHÍ', format: 'currency' },
                { key: 'cogs', title: 'GIÁ VỐN (COGS)', format: 'currency', tooltipText: 'Cost of Goods Sold - Chi phí giá vốn hàng bán.' },
                { key: 'executionCost', title: 'CHI PHÍ THỰC THI', format: 'currency' },
                { key: 'profit', title: 'LỢI NHUẬN', format: 'currency' },
                { key: 'roi', title: 'ROI (%)', format: 'percent', tooltipText: 'Return on Investment - Tỷ suất lợi nhuận trên tổng chi phí. Công thức: (Lợi nhuận / Tổng chi phí) * 100.' },
                { key: 'profitMargin', title: 'TỶ SUẤT LỢI NHUẬN (%)', format: 'percent', tooltipText: 'Tỷ lệ lợi nhuận so với doanh thu. Công thức: (Lợi nhuận / Doanh thu Ròng) * 100.' },
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
                { key: 'cancelledOrders', title: 'ĐƠN HỦY', format: 'number' },
                { key: 'cancellationRate', title: 'TỶ LỆ HỦY', format: 'percent' },
                { key: 'refundRate', title: 'TỶ LỆ HOÀN', format: 'percent' },
                { key: 'aov', title: 'AOV', format: 'currency', tooltipText: 'Average Order Value - Giá trị trung bình của một đơn hàng.' },
                { key: 'upt', title: 'UPT', format: 'number', tooltipText: 'Units Per Transaction - Số sản phẩm trung bình trên một đơn hàng.' },
                { key: 'uniqueSkusSold', title: 'SỐ SKU ĐÃ BÁN', format: 'number', tooltipText: 'Số loại sản phẩm khác nhau đã được bán.' },
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
                            value={customDateRange[0]}
                            onChange={(date) => handleCustomDateChange([date, customDateRange[1]])}
                            maxDate={customDateRange[1]}
                            openTo="day"
                            views={['year', 'month', 'day']}
                            format="DD/MM/YYYY"
                            sx={{ width: 150 }} // Chỉ giữ lại prop sx nếu cần
                        />
                        <DatePicker 
                            label="Đến ngày"
                            value={customDateRange[1]}
                            onChange={(date) => handleCustomDateChange([customDateRange[0], date])}
                            minDate={customDateRange[0]}
                            openTo="day"
                            views={['year', 'month', 'day']}
                            format="DD/MM/YYYY"
                            sx={{ width: 150 }} // Chỉ giữ lại prop sx nếu cần
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