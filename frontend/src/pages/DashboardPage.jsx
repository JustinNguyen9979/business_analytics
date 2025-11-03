// FILE: frontend/src/pages/DashboardPage.jsx (PHIÊN BẢN HOÀN THIỆN)

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Typography, Box, Paper, Divider, CircularProgress, Alert, Button, useTheme } from '@mui/material';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import { useLayout } from '../context/LayoutContext';
import { getBrandDetails, getBrandDailyKpis } from '../services/api';
import { StatItem } from '../components/dashboard/StatItem';
import { kpiGroups } from '../config/dashboardConfig';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);

import RevenueProfitChart from '../components/charts/RevenueProfitChart';
import ChartPlaceholder from '../components/common/ChartPlaceholder';
import DateRangeFilterMenu from '../components/common/DateRangeFilterMenu';
import ChartTimeFilter from '../components/common/ChartTimeFilter';

const getPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return [null, null];
    const duration = endDate.diff(startDate, 'day') + 1;
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(duration - 1, 'day');
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

function DashboardPage() {
    const { brandId } = useParams();
    const navigate = useNavigate();
    const { isSidebarOpen } = useLayout();
    const [searchParams, setSearchParams] = useSearchParams();
    const theme = useTheme();

    // --- STATE CHO KPI ---
    const [kpiDateRange, setKpiDateRange] = useState(() => {
        const start = searchParams.get('start');
        const end = searchParams.get('end');
        return (start && end) ? [dayjs(start), dayjs(end)] : [dayjs().subtract(27, 'days').startOf('day'), dayjs().endOf('day')];
    });
    const [currentKpis, setCurrentKpis] = useState(null);
    const [previousKpis, setPreviousKpis] = useState(null);
    const [kpiAnchorEl, setKpiAnchorEl] = useState(null);

    // --- STATE CHO CHART ---
    const [chartDateRange, setChartDateRange] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    const [dailyChartData, setDailyChartData] = useState([]);
    const [previousDailyChartData, setPreviousDailyChartData] = useState([]);
    
    // --- STATE CHUNG ---
    const [brandInfo, setBrandInfo] = useState({ name: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartRevision, setChartRevision] = useState(0);

    // --- HANDLERS ---
    const handleOpenKpiFilter = (event) => setKpiAnchorEl(event.currentTarget);
    const handleCloseKpiFilter = () => setKpiAnchorEl(null);
    const handleApplyKpiFilter = (newRange) => {
        setKpiDateRange(newRange);
        setSearchParams({ start: newRange[0].format('YYYY-MM-DD'), end: newRange[1].format('YYYY-MM-DD') });
        handleCloseKpiFilter();
    };
    const handleChartFilterChange = useCallback((newRange, type) => {
        setChartDateRange({ range: newRange, type: type });
    }, []);

    // --- FETCH DATA ---
    useEffect(() => {
        const fetchAllData = async () => {
            if (!brandId) return;
            setLoading(true);
            setError(null);

            const [kpiStart, kpiEnd] = kpiDateRange;
            const [prevKpiStart, prevKpiEnd] = getPreviousPeriod(kpiStart, kpiEnd);
            const [chartStart, chartEnd] = chartDateRange.range;
            const [prevChartStart, prevChartEnd] = getPreviousPeriod(chartStart, chartEnd);

            try {
                const [kpiResponse, prevKpiResponse, chartResponse, prevChartResponse] = await Promise.all([
                    getBrandDetails(brandId, kpiStart, kpiEnd),
                    getBrandDetails(brandId, prevKpiStart, prevKpiEnd),
                    getBrandDailyKpis(brandId, chartStart, chartEnd),
                    getBrandDailyKpis(brandId, prevChartStart, prevChartEnd)
                ]);

                if (kpiResponse) setBrandInfo({ id: kpiResponse.id, name: kpiResponse.name });
                setCurrentKpis(kpiResponse ? kpiResponse.kpis : null);
                setPreviousKpis(prevKpiResponse ? prevKpiResponse.kpis : null);
                setDailyChartData(chartResponse || []);
                setPreviousDailyChartData(prevChartResponse || []);
            } catch (err) {
                setError("Không thể tải dữ liệu.");
                console.error("Lỗi khi fetch:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, [brandId, kpiDateRange, chartDateRange, navigate]);

    useEffect(() => {
        const timer = setTimeout(() => setChartRevision(prev => prev + 1), 300);
        return () => clearTimeout(timer);
    }, [isSidebarOpen]);

    if (error) return <Alert severity="error">{error}</Alert>;
    if (loading && !currentKpis) { 
        return <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}><CircularProgress /></Box>; 
    }

    return (
        <Box sx={{ px: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="h4" gutterBottom>{brandInfo.name ? `Báo cáo Kinh doanh: ${brandInfo.name}` : ''}</Typography>
            
            <Paper variant="glass" elevation={0} sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }} noWrap>Chỉ số Hiệu suất Tổng thể</Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" color="text.secondary">
                           {`${kpiDateRange[0].format('DD/MM/YYYY')} - ${kpiDateRange[1].format('DD/MM/YYYY')}`}
                        </Typography>
                        <Button variant="outlined" onClick={handleOpenKpiFilter} startIcon={<CalendarMonthIcon />}>
                            Bộ lọc
                        </Button>
                    </Box>
                </Box>
                
                <Divider sx={{ mb: 3 }} />
                
                {currentKpis ? (
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
                                    {group.items.map((kpi) => (
                                        <StatItem 
                                            key={kpi.key} 
                                            title={kpi.title} 
                                            value={currentKpis[kpi.key]} 
                                            previousValue={previousKpis ? previousKpis[kpi.key] : 0}
                                            format={kpi.format}
                                            tooltipText={kpi.tooltipText}
                                            direction={kpi.direction}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>
                )}
            </Paper>

            <Paper variant="glass" elevation={0} sx={{ p: 1 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 3, pt: 3 }}>
                    {/* 1. Đưa tiêu đề ra ngoài */}
                    <Typography variant="h6" noWrap>Biểu đồ Doanh thu ròng & Lợi nhuận</Typography>
                    {/* 2. Đặt bộ lọc trực tiếp ở đây */}
                    <ChartTimeFilter onFilterChange={handleChartFilterChange} />
                </Box>
                
                <Box sx={{ px: 3, pb: 3, pt: 1 }}>
                    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', height: 450 }}><CircularProgress /></Box> : (
                        dailyChartData.length > 0 ? (
                            <RevenueProfitChart 
                                data={dailyChartData} 
                                comparisonData={previousDailyChartData}
                                chartRevision={chartRevision}
                                filterType={chartDateRange.type}
                            />
                        ) : <ChartPlaceholder />
                    )}
                </Box>
            </Paper>
            
            <DateRangeFilterMenu
                open={Boolean(kpiAnchorEl)}
                anchorEl={kpiAnchorEl}
                onClose={handleCloseKpiFilter}
                initialDateRange={kpiDateRange}
                onApply={handleApplyKpiFilter}
            />
        </Box>
    );
}

export default DashboardPage;