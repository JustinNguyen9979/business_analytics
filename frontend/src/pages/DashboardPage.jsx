// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import { useTheme } from '@mui/material/styles';
import React, { useState, useCallback, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button, Stack } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import dayjs from 'dayjs';
import { getAllBrands } from '../services/api';
import { useDashboardData } from '../hooks/dashboard/useDashboardData';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import TopProductsChart from '../components/charts/TopProductsChart';
import CostDonutChart from '../components/charts/CostDonutChart';
import GeoMapChart from '../components/charts/GeoMapChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import { useLayout } from '../context/LayoutContext';

function DashboardPage() {
    const theme = useTheme();
    const { brandId } = useParams();
    const [brandName, setBrandName] = useState('');
    const [searchParams, setSearchParams] = useSearchParams();
    const { isSidebarOpen } = useLayout();
    
    // const [kpiDateRange, setKpiDateRange] = useState(() => {
    //     const start = searchParams.get('start_kpi');
    //     const end = searchParams.get('end_kpi');
    //     return [start ? dayjs(start) : dayjs().subtract(27, 'days').startOf('day'), end ? dayjs(end) : dayjs().endOf('day')];
    // });

    const [kpiFilter, setKpiFilter] = useState(() => {
        const start = searchParams.get('start_kpi');
        const end = searchParams.get('end_kpi');
        const initialRange = [start ? dayjs(start) : dayjs().subtract(27, 'days').startOf('day'), end ? dayjs(end) : dayjs().endOf('day')];
        // Mặc định ban đầu, ta coi nó là loại 'custom' hoặc 'day'
        return { range: initialRange, type: 'custom' }; 
    });

    const [chartFilter, setChartFilter] = useState({ range: [dayjs().startOf('year'), dayjs().endOf('year')], type: 'year' });

    const { data, loading, error } = useDashboardData(brandId, kpiFilter, chartFilter);

    // --- STATE QUẢN LÝ UI ---
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);

    useEffect(() => {
        const fetchBrandName = async () => {
            try {
                const allBrands = await getAllBrands();
                const currentBrand = allBrands.find(b => b.id === parseInt(brandId));
                if (currentBrand) setBrandName(currentBrand.name);
            } catch (error) { console.error("Lỗi khi lấy tên brand:", error); }
        };
        fetchBrandName();
    }, [brandId]);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    // --- CÁC HÀM HANDLER CHO BỘ LỌC KPI ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = useCallback((newRange, filterType = 'custom') => {
        setKpiFilter({ range: newRange, type: filterType });
        setSearchParams({ start_kpi: newRange[0].format('YYYY-MM-DD'), end_kpi: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    }, [setSearchParams]);

    const handleChartFilterChange = useCallback((range, type) => setChartFilter({ range, type }), []);

    if (error) return <Alert severity="error" sx={{ m: 4 }}>{error}</Alert>;

    return (
        <Box sx={{ px: 4 }} >
            <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
                {brandName ? `Báo cáo Kinh doanh: ${brandName}` : 'Đang tải...'}
            </Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${kpiFilter.range[0].format('DD/MM/YYYY')} - ${kpiFilter.range[1].format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenKpiFilter} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                <Box sx={{ minHeight: 360, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {loading ? (
                        // 1. NẾU ĐANG LOADING: Hiển thị vòng quay
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : data.kpi.current ? (
                        // 2. NẾU KHÔNG LOADING VÀ CÓ DỮ LIỆU: Hiển thị bảng
                        <Box sx={{ 
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                md: 'repeat(2, 1fr)',
                                lg: 'repeat(4, 1fr)',
                            }
                        }}>
                            {kpiGroups.map((group, groupIndex) => (
                                <Box 
                                    key={group.groupTitle} 
                                    sx={{ 
                                        p: 2, 
                                        borderRight: { 
                                            lg: groupIndex < 3 ? `1px solid ${theme.palette.divider}` : 'none',
                                            md: groupIndex % 2 === 0 ? `1px solid ${theme.palette.divider}` : 'none',
                                        }, 
                                        borderBottom: { 
                                            xs: groupIndex < kpiGroups.length - 1 ? `1px solid ${theme.palette.divider}` : 'none',
                                            md: groupIndex < 2 ? `1px solid ${theme.palette.divider}` : 'none',
                                            lg: 'none'
                                        } 
                                    }}
                                >
                                    <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 2, fontWeight: 600, fontSize: '0.875rem', textAlign: 'center' }}>
                                        {group.groupTitle}
                                    </Typography>
                                    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 3, textAlign: 'left' }}>
                                        {group.items.map((kpi) => {
                                            console.log(`Đang render chỉ số: ${kpi.key}`, ' | Giá trị hiện tại:', data.kpi.current[kpi.key], ' | Giá trị kỳ trước:', data.kpi.previous?.[kpi.key]);
                                            return (
                                                <StatItem 
                                                    key={kpi.key} 
                                                    value={data.kpi.current[kpi.key]} 
                                                    previousValue={data.kpi.previous?.[kpi.key]}
                                                    {...kpi} // Dùng spread operator cho gọn
                                                />
                                            );
                                        })} 
                                    </Box>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <ChartPlaceholder title="Chỉ số Hiệu suất" />
                    )}
                </Box>
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1, mb: 4 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    <ChartTimeFilter value={chartFilter} onChange={handleChartFilterChange} />
                </Box>
                
                <Box sx={{ pb: 3, pt: 1, height: 450, position: 'relative' }}>
                    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                        data.chart.current && data.chart.current.length > 0 ? (
                            <RevenueProfitChart 
                                data={data.chart.current} 
                                comparisonData={data.chart.previous}
                                chartRevision={chartRevision}
                                aggregationType={data.chart.aggregationType}
                            />
                        ) : <ChartPlaceholder title="Doanh thu & Lợi nhuận" />
                    )}
                </Box>
            </Paper>

            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    mb: 4,
                }}
            >
                {/* --- BOX CON BÊN TRÁI --- */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 'calc(50% - 16px)' }, 
                    }}
                >
                    {/* Dùng Stack để tạo khoảng cách giữa 2 biểu đồ bên trong */}
                    <Stack spacing={4}>
                        {/* KHỐI 1: DONUT CHART - Tái sử dụng variant="glass" */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Phân bổ Chi phí</Typography>
                                <ChartTimeFilter value={chartFilter} onChange={handleChartFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 400, position: 'relative' }}>
                                {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                                data.donut ? <CostDonutChart {...data.donut} /> : <ChartPlaceholder title="Phân bổ Chi phí"/> 
                            )}
                            </Box>
                        </Paper>

                        {/* KHỐI 2: TOP PRODUCTS CHART - Tái sử dụng variant="glass" */}
                        <Paper variant="glass" elevation={0} sx={{ p: 1, display: 'flex', flexDirection: 'column' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                                <Typography variant="h6" noWrap>Top SKU bán chạy</Typography>
                                <ChartTimeFilter value={chartFilter} onChange={handleChartFilterChange} />
                            </Box>
                            <Box sx={{ flexGrow: 1, minHeight: 600, position: 'relative' }}>
                                {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                                data.topProducts && data.topProducts.length > 0 ? <TopProductsChart data={data.topProducts} /> : <ChartPlaceholder title="Top SKU bán chạy" />
                            )}
                            </Box>
                        </Paper>
                    </Stack>
                </Box>

                {/* --- BOX CON BÊN PHẢI --- */}
                <Box
                    sx={{
                        width: { xs: '100%', md: 'calc(50% - 16px)' },
                        display: 'flex',
                    }}
                >
                    {/* THAY THẾ NỘI DUNG CŨ BẰNG KHỐI NÀY */}
                    <Paper
                        variant="glass"
                        elevation={0}
                        sx={{
                            p: 1,
                            width: '100%',
                            flexGrow: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            minHeight: { xs: 900, md: '100%' }
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 2, pt: 2 }}>
                            <Typography variant="h6" noWrap>Phân bổ Khách hàng</Typography>
                            <ChartTimeFilter value={chartFilter} onChange={handleChartFilterChange} />
                        </Box>
                        <Box sx={{ flexGrow: 1, minHeight: { xs: 500, lg: 'auto' }, position: 'relative' }}>
                            {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box> : (
                                data.map && data.map.length > 0 ? <GeoMapChart data={data.map} /> : <ChartPlaceholder title="Phân bổ Khách hàng" />
                            )}
                        </Box>
                    </Paper>
                </Box>
            </Box>
            
            
            <DateRangeFilterMenu
                open={Boolean(kpiAnchorEl)}
                anchorEl={kpiAnchorEl}
                onClose={handleCloseKpiFilter}
                initialDateRange={kpiFilter.range} 
                onApply={handleApplyKpiFilter}
            />
        </Box>
    );
}

export default DashboardPage;


