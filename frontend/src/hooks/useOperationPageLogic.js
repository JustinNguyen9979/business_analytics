import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@mui/material/styles';
import { useDateFilter } from './useDateFilter'; 
import { fetchOperationKpisAPI, getSourcesForBrand } from '../services/api'; // Thêm API lấy source
import { useBrand } from '../context/BrandContext'; 

export const useOperationPageLogic = () => {
    const theme = useTheme();
    const selectedBrand = useBrand(); 

    // Logic lọc ngày chung cho cả trang
    const { filter, buttonProps, menuProps } = useDateFilter({ defaultType: 'this_month' });

    const [sourceOptions, setSourceOptions] = useState([]);

    // 1. Lấy danh sách Sources khi Brand thay đổi
    useEffect(() => {
        const fetchSources = async () => {
            if (!selectedBrand?.slug) return;
            try {
                const sources = await getSourcesForBrand(selectedBrand.slug);
                setSourceOptions(sources.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })));
            } catch (err) {
                console.error("Error fetching sources:", err);
            }
        };
        fetchSources();
    }, [selectedBrand?.slug]);

    const dateRange = filter.range;
    const dateLabel = buttonProps.children;
    const handleOpenFilter = buttonProps.onClick;
    const anchorEl = menuProps.anchorEl;
    const handleCloseFilter = menuProps.onClose;
    const handleApplyDateRange = menuProps.onApply;

    // 3. Config (Đưa lên trước useState để dùng làm giá trị khởi tạo)
    const kpiConfig = useMemo(() => [
        { 
            key: 'avg_processing_time', 
            title: "Thời gian xử lý TB", 
            max: 48, 
            unit: " giờ", 
            thresholds: [24, 36],           // Xanh < 24, Vàng < 36, Đỏ > 36
            reversecolors: true,
            color: theme.palette.success.main 
        },
        { 
            key: 'avg_shipping_time', 
            title: "Thời gian giao hàng TB", 
            max: 7, 
            unit: " ngày", 
            thresholds: [2, 4],             // Xanh < 2, Vàng < 4, Đỏ > 4
            reversecolors: true,
            color: theme.palette.primary.main 
        },
        { 
            key: 'completion_rate', 
            title: "Tỷ lệ hoàn thành", 
            max: 100, 
            unit: " %", 
            thresholds: [90, 80],           // Xanh > 90, Vàng > 80, Đỏ < 80
            reversecolors: false,
            color: theme.palette.success.main },
        { 
            key: 'cancellation_rate', 
            title: "Tỷ lệ hủy", max: 100, 
            unit: " %", 
            thresholds: [5, 10],            // Xanh < 5, Vàng < 10, Đỏ > 10
            reversecolors: true,
            color: theme.palette.error.main 
        },
        { 
            key: 'post_shipment_issues_rate', 
            title: "Tỷ lệ Hoàn/Bom", 
            max: 100, unit: " %", 
            isStacked: true,
            color: theme.palette.warning.main,
            colorBom: theme.palette.warning.main,
            colorRefund: theme.palette.error.main
        }
    ], [theme]);

    // 2. State quản lý dữ liệu (Khởi tạo default data ngay lập tức)
    const [kpiData, setKpiData] = useState(() => kpiConfig.map(config => ({
        ...config,
        value: 0,
        previousValue: null
    }))); 
    
    // Bổ sung states cho các biểu đồ chi tiết
    const [breakdownData, setBreakdownData] = useState({
        cancelReasons: [],
        hourlyOrders: [],
        paymentRisks: [],
        platformPerf: [],
        locationDistribution: []
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // 4. Effect gọi API
    useEffect(() => {
        const fetchOperationKpis = async () => {
            // Kiểm tra chặt chẽ: Phải có brand slug và range ngày hợp lệ
            if (!selectedBrand?.slug || !dateRange?.[0] || !dateRange?.[1]) {
                return;
            }

            setLoading(true);
            setError(null);
            try {
                const startDateStr = dateRange[0].format('YYYY-MM-DD');
                const endDateStr = dateRange[1].format('YYYY-MM-DD');
                const brandSlug = selectedBrand.slug;
                
                let apiResponse = {};
                try {
                     apiResponse = await fetchOperationKpisAPI(brandSlug, startDateStr, endDateStr);
                } catch (apiErr) {
                    console.warn("API Error, mocking:", apiErr);
                    // Mock data dự phòng để không crash UI
                    apiResponse = { 
                        avg_processing_time: 0, 
                        avg_shipping_time: 0, 
                        completion_rate: 0, 
                        cancellation_rate: 0, 
                        total_orders: 0, 
                        refund_rate: 0, 
                        bomb_rate: 0,
                        cancelled_orders: 0,
                        refunded_orders: 0,
                        cancel_reason_breakdown: {},
                        hourly_breakdown: {},
                        payment_method_breakdown: {},
                        location_distribution: [],
                        platform_comparison: []
                    };
                }

                const mappedData = kpiConfig.map(config => {
                    let val = apiResponse[config.key] !== undefined ? apiResponse[config.key] : 0;
                    
                    // Nếu đơn vị là %, nhân 100 để hiển thị đúng trên Gauge
                    if (config.unit.trim() === '%') {
                        val = val * 100;
                    }

                    if (config.isStacked) {
                        const bombRate = (apiResponse.bomb_rate || 0) * 100;
                        const refundRate = (apiResponse.refund_rate || 0) * 100;

                        const segmentsData = [
                            {
                                label: "Bom hàng",
                                value: parseFloat(bombRate.toFixed(1)),
                                color: config.colorBom
                            },
                            {
                                label: "Hoàn tiền",
                                value: parseFloat(refundRate.toFixed(1)),
                                color: config.colorRefund
                            }
                        ]
                        const combinedRate = parseFloat((bombRate + refundRate).toFixed(1));
                        
                        // Logic scale Max thông minh:
                        let dynamicMax = 100;
                        if (combinedRate <= 5) {
                            dynamicMax = 10;
                        } else if (combinedRate <= 10) {
                            dynamicMax = 20;
                        } else if (combinedRate <= 25) {
                            dynamicMax = 50;
                        } else {
                            dynamicMax = 100;
                        }

                        return {
                            ...config,
                            value: combinedRate,
                            max: dynamicMax,
                            segments: segmentsData,
                            previousValue: null
                        };
                    }

                    return {
                        ...config,
                        value: parseFloat(Number(val).toFixed(1)),
                        previousValue: null
                    };
                });

                setKpiData(mappedData);

                // Xử lý dữ liệu Breakdown cho các biểu đồ mới
                setBreakdownData({
                    cancelReasons: Object.entries(apiResponse.cancel_reason_breakdown || {}).map(([name, value]) => ({ name, value })),
                    hourlyOrders: Object.entries(apiResponse.hourly_breakdown || {}).map(([hour, count]) => ({ hour: `${hour}h`, count })),
                    platformPerf: apiResponse.platform_comparison || [],
                    locationDistribution: apiResponse.location_distribution || [],
                    paymentRisks: Object.entries(apiResponse.payment_method_breakdown || {}).map(([name, value]) => ({ name, value })),
                    topRefundedProducts: apiResponse.top_refunded_products || []
                });

            } catch (err) {
                console.error("Logic Error:", err);
                setKpiData([]); 
            } finally {
                setLoading(false);
            }
        };

        fetchOperationKpis();
    }, [dateRange, selectedBrand, kpiConfig]); // Dependency array phải chứa selectedBrand để re-run khi context update

    return {
        dateRange,
        dateLabel,
        anchorEl,
        handleOpenFilter,
        handleCloseFilter,
        handleApplyDateRange,
        sourceOptions, // Export thêm options
        kpiData, 
        breakdownData, // Export thêm data mới
        loading,
        error
    };
};
