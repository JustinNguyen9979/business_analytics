import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Typography, Box, Grid, Paper, Divider, CircularProgress, Alert, Tabs, Tab, useTheme, useMediaQuery, Button, Menu, MenuItem } from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { getBrandDetails } from '../services/api';
import { StatItem } from '../components/StatItem';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs'; 
import 'dayjs/locale/vi';
import { calculateAllKpis } from '../utils/kpiCalculations';

const ChartPlaceholder = ({ title }) => (
    <Paper variant="placeholder" elevation={0}>
        <Typography variant="h6" color="text.secondary">{title}</Typography>
    </Paper>
);

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

    const kpis = calculateAllKpis(brand);

    const kpiGroups = [
        {
            groupTitle: 'Tài chính',
            items: [
                { title: 'DOANH THU (GMV)', value: kpis.gmv, tooltipText: 'Gross Merchandise Value - Tổng giá trị hàng hóa đã bán (chưa trừ chi phí).' },
                { title: 'TỔNG CHI PHÍ', value: kpis.totalCost },
                { title: 'GIÁ VỐN (COGS)', value: kpis.cogs, tooltipText: 'Cost of Goods Sold - Chi phí giá vốn hàng bán.' },
                { title: 'CHI PHÍ THỰC THI', value: kpis.executionCost },
                { title: 'LỢI NHUẬN', value: kpis.profit },
                { title: 'ROI', value: kpis.roi, tooltipText: 'Return on Investment - Tỷ suất lợi nhuận trên tổng chi phí. Công thức: (Lợi nhuận / Tổng chi phí) * 100.' },
            ]
        },
        {
            groupTitle: 'Marketing',
            items: [
                { title: 'CHI PHÍ ADS', value: kpis.adSpend },
                { title: 'ROAS', value: kpis.roas, tooltipText: 'Return on Ad Spend - Doanh thu trên chi phí quảng cáo. Công thức: Doanh thu từ Ads / Chi phí Ads.' },
                { title: 'CPO', value: kpis.cpo, tooltipText: 'Cost Per Order - Chi phí để có được một đơn hàng từ quảng cáo. Công thức: Chi phí Ads / Số đơn từ Ads.' },
                { title: 'CTR', value: kpis.ctr, tooltipText: 'Click-Through Rate - Tỷ lệ nhấp chuột vào quảng cáo. Công thức: (Số lượt nhấp / Số lượt hiển thị) * 100.' },
                { title: 'CPC', value: kpis.cpc, tooltipText: 'Cost Per Click - Chi phí cho mỗi lượt nhấp chuột vào quảng cáo. Công thức: Chi phí Ads / Số lượt nhấp.' },
                { title: 'TỶ LỆ CHUYỂN ĐỔI', value: kpis.conversionRate },
            ]
        },
        {
            groupTitle: 'Vận hành',
            items: [
                { title: 'TỔNG ĐƠN', value: kpis.totalOrders },
                { title: 'SỐ ĐƠN CHỐT', value: kpis.completedOrders },
                { title: 'SỐ ĐƠN HỦY', value: kpis.cancelledOrders },
                { title: 'TỶ LỆ HỦY ĐƠN', value: kpis.cancellationRate },
                { title: 'TỶ LỆ HOÀN TRẢ', value: kpis.refundRate },
                { title: 'AOV', value: kpis.aov, tooltipText: 'Average Order Value - Giá trị trung bình của một đơn hàng.' },
            ]
        },
        {
            groupTitle: 'Khách hàng',
            items: [
                { title: 'TỔNG LƯỢNG KHÁCH', value: kpis.totalCustomers },
                { title: 'KHÁCH MỚI', value: kpis.newCustomers },
                { title: 'KHÁCH QUAY LẠI', value: kpis.returningCustomers },
                { title: 'CAC', value: kpis.cac, tooltipText: 'Customer Acquisition Cost - Chi phí để có được một khách hàng mới. Công thức: Chi phí Marketing / Số khách hàng mới.' },
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
                            slotProps={{
                                textField: { variant: 'standard', size: 'small', sx: { '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' } } },
                                popper: { sx: { '& .MuiPaper-root': { backdropFilter: 'none', backgroundColor: '#1e2b3b' } } },
                                dialog: { PaperProps: { sx: { backdropFilter: 'none', backgroundColor: '#1e2b3b' } } }
                            }}
                            sx={{ width: 150 }}
                        />
                        <DatePicker 
                            label="Đến ngày"
                            value={customDateRange[1]}
                            onChange={(date) => handleCustomDateChange([customDateRange[0], date])}
                            minDate={customDateRange[0]}
                            openTo="day"
                            views={['year', 'month', 'day']}
                            format="DD/MM/YYYY"
                            slotProps={{
                                textField: { variant: 'standard', size: 'small', sx: { '& .MuiInput-underline:before': { borderBottom: 'none' }, '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' } } },
                                popper: { sx: { '& .MuiPaper-root': { backdropFilter: 'none', backgroundColor: '#1e2b3b' } } },
                                dialog: { PaperProps: { sx: { backdropFilter: 'none', backgroundColor: '#1e2b3b' } } }
                            }}
                            sx={{ width: 150 }}
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
                                        key={kpi.title} 
                                        title={kpi.title} 
                                        value={kpi.value} 
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