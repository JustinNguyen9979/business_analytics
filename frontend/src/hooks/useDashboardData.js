import { useState, useEffect } from 'react';
import axios from 'axios';
import { fetchAsyncData, fetchCustomerMap } from '../services/api';
import dayjs from 'dayjs';
import { processChartData, determineAggregation } from '../utils/chartDataProcessor';

/**
 * TÍNH TOÁN KHOẢNG THỜI GIAN SO SÁNH THÔNG MINH - ĐÃ SỬA LỖI
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month', 'custom').
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */

const getPreviousPeriod = (startDate, endDate, filterType = 'custom') => {
    if (!startDate || !endDate) return [null, null];

    // --- LOGIC MỚI ---

    // 1. Xử lý trường hợp "Tháng hiện tại" (this_month)
    // So sánh "cùng kỳ" ngày-đối-ngày. Ví dụ: 1-23/11 so với 1-23/10
    if (filterType === 'this_month') {
        const dayOfMonth = endDate.date(); // Lấy ngày trong tháng của ngày kết thúc (ví dụ: 23)
        const prevMonthStartDate = startDate.clone().subtract(1, 'month');
        
        // Tính ngày kết thúc của kỳ so sánh
        let prevMonthEndDate = prevMonthStartDate.clone().date(dayOfMonth);

        // Xử lý trường hợp tháng trước không có ngày tương ứng (ví dụ: so sánh 31/3 với tháng 2)
        // dayjs sẽ tự động chuyển sang tháng sau, nên ta cần clamp nó về cuối tháng trước.
        if (prevMonthEndDate.month() !== prevMonthStartDate.month()) {
            prevMonthEndDate = prevMonthStartDate.clone().endOf('month');
        }
        
        // console.log('Kỳ hiện tại (cùng kỳ):', startDate.format('YYYY-MM-DD'), '-', endDate.format('YYYY-MM-DD'));
        // console.log('Kỳ so sánh (cùng kỳ):', prevMonthStartDate.format('YYYY-MM-DD'), '-', prevMonthEndDate.format('YYYY-MM-DD'));
        // console.log('Loại bộ lọc:', filterType);

        return [prevMonthStartDate, prevMonthEndDate];
    }

    // 2. Xử lý các bộ lọc có khoảng thời gian cố định theo lịch (nguyên tháng, quý, năm)
    if (['this_year', 'last_month', 'year', 'quarter', 'month'].includes(filterType) || (typeof filterType === 'string' && filterType.startsWith('Quý'))) {
        const durationInMonths = endDate.diff(startDate, 'month') + 1; // +1 để bao gồm cả tháng cuối
        const prevStartDate = startDate.clone().subtract(durationInMonths, 'month');
        const prevEndDate = startDate.clone().subtract(1, 'day');
        
        // console.log('Kỳ hiện tại (toàn kỳ):', startDate.format('YYYY-MM-DD'), '-', endDate.format('YYYY-MM-DD'));
        // console.log('Kỳ so sánh (toàn kỳ):', prevStartDate.startOf('month').format('YYYY-MM-DD'), '-', prevEndDate.endOf('day').format('YYYY-MM-DD'));
        // console.log('Loại bộ lọc:', filterType);

        return [prevStartDate.startOf('month'), prevEndDate.endOf('day')];
    }
    
    // Logic 3: Dành cho các khoảng ngày tùy chỉnh (ví dụ: 7 ngày qua, 28 ngày qua)
    const durationInDays = endDate.diff(startDate, 'day') + 1;
    let prevEndDate = startDate.clone().subtract(1, 'day');
    let prevStartDate;

    // Nếu kỳ hiện tại là một khoảng thời gian "tròn tháng" (bắt đầu từ ngày 1 và kết thúc vào cuối tháng)
    if (startDate.date() === 1 && endDate.endOf('month').isSame(endDate, 'day')) {
        const durationInMonths = endDate.diff(startDate, 'month') + 1;
        prevStartDate = startDate.clone().subtract(durationInMonths, 'month').startOf('month');
        // prevEndDate sẽ là ngày cuối cùng của kỳ so sánh, đảm bảo nó là cuối tháng
        prevEndDate = prevStartDate.clone().add(durationInMonths, 'month').subtract(1, 'day').endOf('month');
    } else {
        // Logic mặc định cho các khoảng ngày tùy chỉnh khác
        prevStartDate = prevEndDate.clone().subtract(durationInDays - 1, 'day');
    }

    // console.log('Kỳ hiện tại (ngày tùy chỉnh):', startDate.format('YYYY-MM-DD'), '-', endDate.format('YYYY-MM-DD'));
    // console.log('Kỳ so sánh (ngày tùy chỉnh):', prevStartDate.format('YYYY-MM-DD'), '-', prevEndDate.format('YYYY-MM-DD'));
    // console.log('Loại bộ lọc:', filterType);

    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

/**
 * Custom Hook DUY NHẤT, linh hoạt để quản lý nhiều khối dữ liệu độc lập trên dashboard.
 * @param {string} brandSlug - Slug của thương hiệu.
 * @param {object} filters - Một object chứa các bộ lọc cho từng khối dữ liệu.
 * Ví dụ: { kpi: kpiFilter, lineChart: chartFilter, donut: donutFilter, ... }
 */
export const useDashboardData = (brandSlug, filters) => {
    // <<< THAY ĐỔI 1: Cấu trúc state mới, mỗi khối dữ liệu là một object riêng >>>
    const [state, setState] = useState({
        finance: { data: { current: null, previous: null }, loading: true, error: null },
        marketing: { data: { current: null, previous: null }, loading: true, error: null },
        operations: { data: { current: null, previous: null }, loading: true, error: null },
        customers: { data: { current: null, previous: null }, loading: true, error: null },
        lineChart: { data: { current: [], previous: [], aggregationType: 'day' }, loading: true, error: null },
        donut: { data: null, loading: true, error: null },
        topProducts: { data: null, loading: true, error: null },
        map: { data: null, loading: true, error: null },
    });

    // Hàm tiện ích để cập nhật state cho một khối cụ thể
    const updateState = (key, newState) => {
        setState(prevState => ({
            ...prevState,
            [key]: { ...prevState[key], ...newState },
        }));
    };

    // <<< THAY ĐỔI 2: Helper function cho KPI groups >>>
    const createKpiEffect = (key, filter) => {
        useEffect(() => {
            if (!brandSlug || !filter || !filter.range) return;

            const controller = new AbortController();

            const fetchKpi = async () => {
                updateState(key, { loading: true, error: null });
                const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);
                try {
                    const [current, previous] = await Promise.all([
                        fetchAsyncData('kpi_summary', brandSlug, filter.range, {}, controller.signal),
                        fetchAsyncData('kpi_summary', brandSlug, prevRange, {}, controller.signal)
                    ]);
                    updateState(key, { data: { current, previous }, loading: false });
                } catch (err) {
                    if (!axios.isCancel(err)) {
                        updateState(key, { error: err.message || `Lỗi tải dữ liệu ${key}.`, loading: false });
                    }
                }
            };
            
            fetchKpi();

            return () => controller.abort();
        }, [brandSlug, filter?.range, filter?.type]);
    };

    createKpiEffect('finance', filters.finance);
    createKpiEffect('marketing', filters.marketing);
    createKpiEffect('operations', filters.operations);
    createKpiEffect('customers', filters.customers);

    // <<< THAY ĐỔI 3: useEffect riêng cho Biểu đồ đường (Line Chart) >>>
    useEffect(() => {
        const filter = filters.lineChart;
        if (!brandSlug || !filter || !filter.range) return;
        
        const controller = new AbortController();
        let timeoutId;

        const fetchLineChart = async () => {
            updateState('lineChart', { loading: true, error: null });
            
            // --- XỬ LÝ 1: NẾU KHÔNG CHỌN SOURCE NÀO (Empty Array) ---
            // "Bắt event" ngay tại đây: Không gọi API, tự tạo data 0 trả về luôn.
            if (Array.isArray(filter.source) && filter.source.length === 0) {
                const [start, end] = filter.range;
                const zeroData = [];
                let curr = start.clone();
                while (curr.isBefore(end) || curr.isSame(end, 'day')) {
                    zeroData.push({
                        date: curr.format('YYYY-MM-DD'),
                        net_revenue: 0, profit: 0, gmv: 0, total_cost: 0, ad_spend: 0, cogs: 0, execution_cost: 0
                    });
                    curr = curr.add(1, 'day');
                }
                
                // Giả lập dữ liệu kỳ trước cũng bằng 0
                const prevZeroData = zeroData.map(d => ({ ...d })); 

                updateState('lineChart', { 
                    data: {
                        current: zeroData,
                        previous: prevZeroData,
                        aggregationType: 'day',
                    }, 
                    loading: false 
                });
                return; // Dừng, không gọi API nữa
            }

                            // --- XỬ LÝ 2: GỌI API BÌNH THƯỜNG ---

                        const interval = determineAggregation(filter.range, filter.type);
                        const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);

                        try {

                            // ĐÃ SỬA: Truyền thêm filter.source và interval vào params

                            const [currentRes, previousRes] = await Promise.all([

                                fetchAsyncData('daily_kpis_chart', brandSlug, filter.range, { source: filter.source, interval }, controller.signal),

                                fetchAsyncData('daily_kpis_chart', brandSlug, prevRange, { source: filter.source, interval }, controller.signal)

                            ]);

            

                            // Lấy aggregationType từ backend trả về (nếu có)

                            const currentAggType = currentRes?.aggregationType || null;

                            const prevAggType = previousRes?.aggregationType || null;

            

                            const processedCurrent = processChartData(currentRes?.data, filter, currentAggType);

                            const processedPrevious = processChartData(previousRes?.data, { range: prevRange, type: filter.type }, prevAggType);

            

                            updateState('lineChart', { 

                                data: {

                                    current: processedCurrent.aggregatedData,

                                    previous: processedPrevious.aggregatedData,

                                    aggregationType: processedCurrent.aggregationType,

                                }, 

                                loading: false 

                            });

            
            } catch (err) {
                if (!axios.isCancel(err)) {
                    updateState('lineChart', { error: err.message || 'Lỗi tải dữ liệu biểu đồ.', loading: false });
                }
            }
        };

        // Debounce: Đợi 500ms sau khi filter thay đổi mới gọi API
        timeoutId = setTimeout(() => {
            fetchLineChart();
        }, 500);

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [brandSlug, filters.lineChart?.range, filters.lineChart?.type, filters.lineChart?.source]); // Dependencies cụ thể

    // <<< THAY ĐỔI 4: useEffect riêng cho các biểu đồ còn lại (Donut, Top Products, Map) >>>
    // Helper function để tránh lặp code
    const createSingleChartEffect = (key, requestType, filter) => {
        useEffect(() => {
            if (!brandSlug || !filter || !filter.range) return;
            
            const controller = new AbortController();

            const fetchData = async () => {
                updateState(key, { loading: true, error: null });
                try {
                    const result = await fetchAsyncData(requestType, brandSlug, filter.range, {}, controller.signal);
                    updateState(key, { data: result, loading: false });
                } catch (err) {
                    if (!axios.isCancel(err)) {
                        updateState(key, { error: err.message || `Lỗi tải dữ liệu ${key}.`, loading: false });
                    }
                }
            };

            fetchData();

            return () => controller.abort();
        }, [brandSlug, filter?.range, filter?.type]); // Dependency là range và type bên trong filter
    };

    createSingleChartEffect('donut', 'kpi_summary', filters.donut);
    createSingleChartEffect('topProducts', 'top_products', filters.topProducts);
    
    // <<< THAY ĐỔI 5: Effect riêng cho MAP (Gọi API trực tiếp, không qua Worker) >>>
    useEffect(() => {
        const filter = filters.map;
        if (!brandSlug || !filter || !filter.range) return;
        
        const controller = new AbortController();

        const fetchMapData = async () => {
            updateState('map', { loading: true, error: null });
            const [start, end] = filter.range;
            try {
                // Gọi API trực tiếp (Synchronous)
                // DashboardPage: Mặc định chỉ lấy đơn 'completed' (đơn sạch)
                const result = await fetchCustomerMap(
                    brandSlug, 
                    start.format('YYYY-MM-DD'), 
                    end.format('YYYY-MM-DD'), 
                    ['completed', 'cancelled', 'bomb', 'refunded'], 
                    [],
                    controller.signal
                );
                updateState('map', { data: result, loading: false });
            } catch (err) {
                if (!axios.isCancel(err)) {
                    updateState('map', { error: err.message || 'Lỗi tải dữ liệu bản đồ.', loading: false });
                }
            }
        };

        fetchMapData();

        return () => controller.abort();
    }, [brandSlug, filters.map?.range]); // Dependency là range của map
    
    // Trả về toàn bộ state đã được cấu trúc
    return state;
};