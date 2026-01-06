import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { processChartData } from '../utils/chartDataProcessor'; // Import Processor
import { useDateFilter } from './useDateFilter'; 
import { useChartFilter } from './useChartFilter';
import { getSourcesForBrand, fetchCustomerKpisAPI } from '../services/api'; 
import { useBrand } from '../context/BrandContext'; 

// --- Helper Hook: Quản lý logic cho từng Box biểu đồ ---
const useChartBoxLogic = (globalFilterState, brandSlug, dataKey) => {
    const filter = useChartFilter(globalFilterState);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!brandSlug) return;
        setLoading(true);
        try {
            const [start, end] = filter.dateRange;
            const startDate = start.format('YYYY-MM-DD');
            const endDate = end.format('YYYY-MM-DD');
            const sources = filter.selectedSources;

            // Gọi API chung (trả về tất cả data, ta chỉ lấy phần cần thiết)
            // Lưu ý: Nếu muốn tối ưu hơn, Backend nên hỗ trợ tham số ?fields=trend_data
            const response = await fetchCustomerKpisAPI(brandSlug, startDate, endDate, sources);

            if (dataKey === 'trend') {
                // Map DailyKpi -> Chart Data
                // --- SỬ DỤNG PROCESSOR ĐỂ GOM NHÓM ---
                const chartFilter = { range: filter.dateRange };
                const { aggregatedData } = processChartData(response.trend_data, chartFilter);

                setData(aggregatedData.map(d => ({
                    date: d.date,
                    new_customers: d.new_customers,
                    returning_customers: d.returning_customers
                })));
            } else if (dataKey === 'segment') {
                setData(response.segment_data || []);
            } else if (dataKey === 'frequency') {
                setData(response.frequency_data || []);
            } else if (dataKey === 'cycle') {
                 // Placeholder: Cycle chưa có trong response chuẩn, dùng tạm mock hoặc logic từ trend
                 setData(Array.from({ length: 6 }).map((_, i) => ({
                    date: `2024-0${i + 1}-01`,
                    value: Math.floor(30 + Math.random() * 10),
                })));
            }
        } catch (err) {
            console.error(`Error fetching ${dataKey}:`, err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [brandSlug, filter.dateRange, filter.selectedSources, dataKey]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return useMemo(() => ({ filter, data, loading }), [filter, data, loading]);
};

// 4. Mock Customer List (Static)
const customerList = [
    { name: 'Nguyễn Văn A', phone: '090***123', total_orders: 15, total_spent: 15000000, avg_order_value: 1000000, risk: 'low' },
    { name: 'Trần Thị B', phone: '091***456', total_orders: 2, total_spent: 500000, avg_order_value: 250000, risk: 'high' },
    { name: 'Lê Văn C', phone: '093***789', total_orders: 5, total_spent: 2500000, avg_order_value: 500000, risk: 'medium' },
    { name: 'Phạm Thị D', phone: '098***111', total_orders: 8, total_spent: 8000000, avg_order_value: 1000000, risk: 'low' },
];

export const useCustomerPageLogic = () => {
    const theme = useTheme();
    const { slug: brandSlug } = useBrand(); 

    // 1. Quản lý Bộ lọc & Nguồn Tổng (Global)
    const globalDateFilter = useDateFilter({ 
        defaultType: 'this_month',
        useUrl: true, 
        urlPrefix: 'cus_' 
    });
    const [sourceOptions, setSourceOptions] = useState([]);

    useEffect(() => {
        const fetchSources = async () => {
            if (!brandSlug) return;
            try {
                const sources = await getSourcesForBrand(brandSlug);
                setSourceOptions(sources.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })));
            } catch (err) {
                console.error("Error fetching sources:", err);
            }
        };
        fetchSources();
    }, [brandSlug]);

    const globalFilterState = useMemo(() => ({
        dateRange: globalDateFilter.filter.range,
        dateLabel: globalDateFilter.buttonProps.children
    }), [globalDateFilter.filter.range, globalDateFilter.buttonProps.children]);

    // 2. Logic cho từng Box Biểu đồ
    const trendChart = useChartBoxLogic(globalFilterState, brandSlug, 'trend');
    const segmentChart = useChartBoxLogic(globalFilterState, brandSlug, 'segment');
    // New Charts
    const frequencyChart = useChartBoxLogic(globalFilterState, brandSlug, 'frequency');
    const cycleChart = useChartBoxLogic(globalFilterState, brandSlug, 'cycle');

    // 3. Logic cho KPI Tổng quan
    const kpiConfig = useMemo(() => [
        { key: 'total_customers', label: 'Tổng Khách hàng', max: 20000, unit: ' kh', color: theme.palette.primary.main },
        { key: 'new_customers', label: 'Khách mới', max: 1000, unit: ' kh', color: '#00E676' },
        { key: 'returning_customers', label: 'Khách quay lại', max: 1000, unit: ' kh', color: '#2979FF' },
        { key: 'retention_rate', label: 'Tỷ lệ Quay lại', max: 100, unit: '%', color: '#FFC107' },
        { key: 'arpu', label: 'Chi tiêu TB (ARPU)', max: 1000000, unit: ' đ', color: '#9C27B0' },
        { key: 'ltv', label: 'Lợi nhuận TB (LTV)', max: 5000000, unit: ' đ', color: '#FF3D00' },
    ], [theme]);

    const [kpiData, setKpiData] = useState(() => kpiConfig.map(c => ({ ...c, value: 0 })));
    const [globalLoading, setGlobalLoading] = useState(false);

    useEffect(() => {
        const fetchGlobalKpis = async () => {
            if (!brandSlug) return;
            setGlobalLoading(true);
            try {
                const [start, end] = globalFilterState.dateRange;
                // Fetch KPI tổng (không lọc source, hoặc lọc theo logic global nếu có selector global - hiện tại customer page chưa có global source selector rõ ràng ngoài chart, nhưng mock có sourceOptions)
                // Giả sử lấy 'all' source cho KPI tổng quan
                const data = await fetchCustomerKpisAPI(
                    brandSlug, 
                    start.format('YYYY-MM-DD'), 
                    end.format('YYYY-MM-DD'), 
                    ['all'] 
                );

                setKpiData(kpiConfig.map(c => {
                    let val = data[c.key] || 0;
                    let prevVal = 0;

                    // Lấy dữ liệu kỳ trước nếu có
                    if (data.previous_period && typeof data.previous_period[c.key] !== 'undefined') {
                        prevVal = data.previous_period[c.key];
                    }

                    // Format lại số nếu cần (ví dụ tỉ lệ %)
                    if (c.key === 'retention_rate') {
                        val = parseFloat(val.toFixed(2));
                        prevVal = parseFloat(prevVal.toFixed(2));
                    }
                    
                    return { ...c, value: val, previousValue: prevVal };
                }));

            } catch (err) {
                console.error("Error fetching Global Customer KPIs:", err);
            } finally {
                setGlobalLoading(false);
            }
        };

        fetchGlobalKpis();
    }, [brandSlug, globalFilterState.dateRange, kpiConfig]);

    // 4. Return Value (Memoized)
    const charts = useMemo(() => ({
        trend: trendChart,
        segment: segmentChart,
        frequency: frequencyChart,
        cycle: cycleChart
    }), [trendChart, segmentChart, frequencyChart, cycleChart]);

    return {
        dateRange: globalDateFilter.filter.range,
        dateLabel: globalDateFilter.buttonProps.children,
        anchorEl: globalDateFilter.menuProps.anchorEl,
        handleOpenFilter: globalDateFilter.buttonProps.onClick,
        handleCloseFilter: globalDateFilter.menuProps.onClose,
        handleApplyDateRange: globalDateFilter.menuProps.onApply,
        sourceOptions,
        kpiData,
        globalLoading,
        charts,
        customerList
    };
};
