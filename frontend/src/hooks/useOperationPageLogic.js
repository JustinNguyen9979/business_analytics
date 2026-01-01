import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from '@mui/material/styles';
import { useDateFilter } from './useDateFilter'; 
import { useChartFilter } from './useChartFilter';
import { fetchOperationKpisAPI, getSourcesForBrand, fetchCustomerMap } from '../services/api'; 
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
            const start = filter.dateRange[0].format('YYYY-MM-DD');
            const end = filter.dateRange[1].format('YYYY-MM-DD');
            const sources = filter.selectedSources;

            if (sources && sources.length === 0) {
                setData([]);
                return;
            }

            // Gọi API chung
            const response = await fetchOperationKpisAPI(brandSlug, start, end, sources);
            
            // Map dữ liệu dựa theo key
            if (dataKey === 'cancelReasons') {
                setData(Object.entries(response.cancel_reason_breakdown || {}).map(([name, value]) => ({ name, value })));
            } else if (dataKey === 'topRefunded') {
                setData(response.top_refunded_products || []);
            } else if (dataKey === 'hourly') {
                setData(Object.entries(response.hourly_breakdown || {}).map(([hour, count]) => ({ hour: `${hour}h`, count })));
            } else if (dataKey === 'payment') {
                const breakdown = response.payment_method_breakdown || {};
                setData(Object.entries(breakdown).map(([name, value]) => ({name, value})));
            } else if (dataKey === 'platform') {
                setData(response.platform_comparison || []);
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

// --- Helper Hook Riêng Cho Map (Hỗ trợ Filter Status) ---
const useGeoMapLogic = (globalFilterState, brandSlug) => {
    const filter = useChartFilter(globalFilterState);
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Status Filter cho Map: Mặc định lấy hết ('all' + các trạng thái cụ thể)
    // Điều này giúp UI hiển thị đúng trạng thái "Tất cả" được chọn từ đầu
    const [statusFilter, setStatusFilter] = useState(['all', 'completed', 'cancelled', 'bomb', 'refunded']); 

    // Thay thế toggleStatus đơn giản bằng hàm set trực tiếp để hỗ trợ logic 'Excel-like'
    const applyStatusFilter = useCallback((newStatusList) => {
        setStatusFilter(newStatusList);
    }, []);

    const fetchMapData = useCallback(async () => {
        if (!brandSlug) return;
        
        // Nếu không chọn status nào hoặc không chọn source nào -> Không gọi API, trả về rỗng ngay
        // Lưu ý: filter.selectedSources có thể là undefined lúc đầu nên cần check tồn tại
        if (statusFilter.length === 0 || (filter.selectedSources && filter.selectedSources.length === 0)) {
            setData([]);
            return;
        }

        setLoading(true);
        try {
            const start = filter.dateRange[0].format('YYYY-MM-DD');
            const end = filter.dateRange[1].format('YYYY-MM-DD');
            
            // Lọc bỏ 'all' trước khi gửi xuống API (vì Backend không hiểu 'all' trong list status)
            const apiStatusParam = statusFilter.filter(s => s !== 'all');

            // Gọi API Customer Map riêng biệt, có truyền sources
            const result = await fetchCustomerMap(brandSlug, start, end, apiStatusParam, filter.selectedSources);
            setData(result || []);
        } catch (err) {
            console.error("Error fetching Geo Map:", err);
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [brandSlug, filter.dateRange, statusFilter, filter.selectedSources]);

    useEffect(() => {
        fetchMapData();
    }, [fetchMapData]);

    return useMemo(() => ({ 
        filter, 
        data, 
        loading,
        statusFilter, // Expose ra ngoài
        applyStatusFilter // Expose hàm set mới
    }), [filter, data, loading, statusFilter, applyStatusFilter]);
};

export const useOperationPageLogic = () => {
    const theme = useTheme();
    const { slug: brandSlug } = useBrand(); 

    // 1. Quản lý Bộ lọc & Nguồn Tổng (Global)
    const { filter: globalDateFilter, buttonProps, menuProps } = useDateFilter({ defaultType: 'this_month' });
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
        dateRange: globalDateFilter.range,
        dateLabel: buttonProps.children
    }), [globalDateFilter.range, buttonProps.children]);

    // 2. Logic cho từng Box Biểu đồ
    const cancelReasonChart = useChartBoxLogic(globalFilterState, brandSlug, 'cancelReasons');
    const topRefundChart = useChartBoxLogic(globalFilterState, brandSlug, 'topRefunded');
    const hourlyChart = useChartBoxLogic(globalFilterState, brandSlug, 'hourly');
    const paymentChart = useChartBoxLogic(globalFilterState, brandSlug, 'payment');
    const platformChart = useChartBoxLogic(globalFilterState, brandSlug, 'platform');
    
    // 2.1 Logic Riêng cho Map
    const geoChart = useGeoMapLogic(globalFilterState, brandSlug);

    // 3. Logic cho phần KPI Tổng quan (Vẫn giữ nguyên vì logic map phức tạp)
    // Config KPI
    const kpiConfig = useMemo(() => [
        { key: 'avg_processing_time', title: "Thời gian xử lý TB", max: 48, unit: " giờ", thresholds: [24, 36], reversecolors: true, color: theme.palette.success.main },
        { key: 'avg_shipping_time', title: "Thời gian giao hàng TB", max: 7, unit: " ngày", thresholds: [2, 4], reversecolors: true, color: theme.palette.primary.main },
        { key: 'completion_rate', title: "Tỷ lệ hoàn thành", max: 100, unit: " %", thresholds: [90, 80], reversecolors: false, color: theme.palette.success.main },
        { key: 'cancellation_rate', title: "Tỷ lệ hủy", max: 100, unit: " %", thresholds: [5, 10], reversecolors: true, color: theme.palette.error.main },
        { key: 'post_shipment_issues_rate', title: "Tỷ lệ Hoàn/Bom", max: 100, unit: " %", isStacked: true, color: theme.palette.warning.main, colorBom: theme.palette.warning.main, colorRefund: theme.palette.error.main }
    ], [theme]);

    const [kpiData, setKpiData] = useState(() => kpiConfig.map(c => ({ ...c, value: 0 })));
    const [globalLoading, setGlobalLoading] = useState(false);

    useEffect(() => {
        const fetchGlobalKpis = async () => {
            if (!brandSlug) return;
            setGlobalLoading(true);
            try {
                const start = globalDateFilter.range[0].format('YYYY-MM-DD');
                const end = globalDateFilter.range[1].format('YYYY-MM-DD');
                // Gọi API với 'all' sources mặc định cho KPI tổng
                const apiResponse = await fetchOperationKpisAPI(brandSlug, start, end); 

                const mappedData = kpiConfig.map(config => {
                    let val = apiResponse[config.key] !== undefined ? apiResponse[config.key] : 0;
                    if (config.unit.trim() === '%') val = val * 100;

                    if (config.isStacked) {
                        const bombRate = (apiResponse.bomb_rate || 0) * 100;
                        const refundRate = (apiResponse.refund_rate || 0) * 100;
                        const combinedRate = parseFloat((bombRate + refundRate).toFixed(1));
                        
                        let dynamicMax = 100;
                        if (combinedRate <= 5) dynamicMax = 10;
                        else if (combinedRate <= 10) dynamicMax = 20;
                        else if (combinedRate <= 25) dynamicMax = 50;

                        return {
                            ...config,
                            value: combinedRate,
                            max: dynamicMax,
                            segments: [
                                { label: "Bom hàng", value: parseFloat(bombRate.toFixed(1)), color: config.colorBom },
                                { label: "Hoàn tiền", value: parseFloat(refundRate.toFixed(1)), color: config.colorRefund }
                            ]
                        };
                    }
                    return { ...config, value: parseFloat(Number(val).toFixed(1)) };
                });
                setKpiData(mappedData);
            } catch (err) {
                console.error("KPI Error:", err);
            } finally {
                setGlobalLoading(false);
            }
        };
        fetchGlobalKpis();
    }, [brandSlug, globalDateFilter.range, kpiConfig]);

        // 4. Return

        const charts = useMemo(() => ({
            cancelReason: cancelReasonChart,
            topRefund: topRefundChart,
            hourly: hourlyChart,
            payment: paymentChart,
            geo: geoChart,
            platform: platformChart
        }), [cancelReasonChart, topRefundChart, hourlyChart, paymentChart, geoChart, platformChart]);

        return {
            // Global Filters
            dateRange: globalDateFilter.range,
            dateLabel: buttonProps.children,
            anchorEl: menuProps.anchorEl,
            handleOpenFilter: buttonProps.onClick,
            handleCloseFilter: menuProps.onClose,
            handleApplyDateRange: menuProps.onApply,
            sourceOptions,

            // Global KPI Data
            kpiData,
            globalLoading,

            // Chart Data Controllers
            charts
        };
    };