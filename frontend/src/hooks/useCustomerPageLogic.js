import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { processChartData } from '../utils/chartDataProcessor'; // Import Processor
import { useDateFilter } from './useDateFilter'; 
import { useChartFilter } from './useChartFilter';
import { getSourcesForBrand, fetchCustomerKpisAPI, fetchTopCustomersAPI } from '../services/api'; 
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
                // Map DailyKpi -> Chart Data cho Chu kỳ mua lại
                const chartFilter = { range: filter.dateRange };
                const { aggregatedData } = processChartData(response.trend_data, chartFilter);

                setData(aggregatedData.map(d => ({
                    date: d.date,
                    value: d.avg_repurchase_cycle || 0
                })));
            } else if (dataKey === 'churn') {
                // Map DailyKpi -> Chart Data cho Tỷ lệ rời bỏ
                const chartFilter = { range: filter.dateRange };
                const { aggregatedData } = processChartData(response.trend_data, chartFilter);

                setData(aggregatedData.map(d => ({
                    date: d.date,
                    value: parseFloat((d.churn_rate || 0).toFixed(2))
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
    const churnChart = useChartBoxLogic(globalFilterState, brandSlug, 'churn');

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
                const data = await fetchCustomerKpisAPI(
                    brandSlug, 
                    start.format('YYYY-MM-DD'), 
                    end.format('YYYY-MM-DD'), 
                    ['all'] 
                );

                setKpiData(kpiConfig.map(c => {
                    let val = data[c.key] || 0;
                    let prevVal = 0;

                    if (data.previous_period && typeof data.previous_period[c.key] !== 'undefined') {
                        prevVal = data.previous_period[c.key];
                    }

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

    // 4. Logic cho Bảng Top Khách hàng (DỮ LIỆU THẬT + CÓ FILTER)
    const tableFilter = useChartFilter(globalFilterState);
    const [customerList, setCustomerList] = useState([]);
    const [listLoading, setListLoading] = useState(false);

    useEffect(() => {
        const fetchTopCustomers = async () => {
            if (!brandSlug) return;
            setListLoading(true);
            try {
                // Hiện tại API lấy Top Customer là dữ liệu tích lũy (Lifetime) nên chưa support lọc theo DateRange
                // Tuy nhiên, ta có thể support lọc theo Source nếu Backend hỗ trợ (Hiện tại Backend chưa, nhưng Frontend chuẩn bị sẵn)
                // const sources = tableFilter.selectedSources; 
                
                const data = await fetchTopCustomersAPI(brandSlug, 20, 'total_spent', 'desc');
                setCustomerList(data);
            } catch (err) {
                console.error("Error fetching top customers:", err);
                setCustomerList([]);
            } finally {
                setListLoading(false);
            }
        };

        fetchTopCustomers();
    }, [brandSlug, tableFilter.selectedSources]); // Reload khi source thay đổi (nếu có logic filter)

    // Gom nhóm lại thành object tableData chuẩn để UI dùng
    const tableData = useMemo(() => ({
        data: customerList,
        loading: listLoading,
        filter: tableFilter
    }), [customerList, listLoading, tableFilter]);

    // 5. Return Value (Memoized)
    const charts = useMemo(() => ({
        trend: trendChart,
        segment: segmentChart,
        frequency: frequencyChart,
        cycle: cycleChart,
        churn: churnChart
    }), [trendChart, segmentChart, frequencyChart, cycleChart, churnChart]);

    return {
        dateRange: globalDateFilter.filter.range,
        dateLabel: globalDateFilter.buttonProps.children,
        anchorEl: globalDateFilter.menuProps.anchorEl,
        handleOpenFilter: globalDateFilter.buttonProps.onClick,
        handleCloseFilter: globalDateFilter.menuProps.onClose,
        handleApplyDateRange: globalDateFilter.menuProps.onApply,
        sourceOptions,
        kpiData,
        globalLoading, // Dùng chung cho KPI cards
        charts,
        tableData,     // Thay vì trả về customerList rời rạc, trả về object trọn gói
    };
};
