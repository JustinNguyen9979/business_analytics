import { useState, useEffect } from 'react';
import axios from 'axios';
import { fetchAsyncData } from '../../services/api';
import dayjs from 'dayjs';
import { processChartData } from '../../utils/chartDataProcessor';

/**
 * TÍNH TOÁN KHOẢNG THỜI GIAN SO SÁNH THÔNG MINH - ĐÃ SỬA LỖI
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month', 'custom').
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */

const getPreviousPeriod = (startDate, endDate, filterType = 'custom') => {
    if (!startDate || !endDate) return [null, null];

    // === PHẦN SỬA ĐỔI BẮT ĐẦU ===
    // Logic 1: Dành cho các bộ lọc có đơn vị lịch rõ ràng
    if (['year', 'quarter', 'month'].includes(filterType)) {
        // 1. Tính khoảng thời gian của kỳ hiện tại (tính bằng tháng)
        // Ví dụ: T4 -> T6 là 3 tháng. endDate.diff(startDate, 'month') = 2. Do đó cần +1
        const durationInMonths = endDate.diff(startDate, 'month') + 1;

        // 2. Ngày bắt đầu của kỳ trước = Ngày bắt đầu kỳ này trừ đi khoảng thời gian
        const prevStartDate = startDate.clone().subtract(durationInMonths, 'month');

        // 3. Ngày kết thúc của kỳ trước = Ngày bắt đầu kỳ này trừ đi 1 ngày
        const prevEndDate = startDate.clone().subtract(1, 'day');

        return [prevStartDate.startOf('month'), prevEndDate.endOf('day')];
    }
    // === PHẦN SỬA ĐỔI KẾT THÚC ===

    // Logic 2: Dành cho các bộ lọc theo khoảng ngày tùy chỉnh (ví dụ: 7 ngày qua, 28 ngày qua)
    // Logic này vốn đã đúng nên giữ nguyên.
    const durationInDays = endDate.diff(startDate, 'day') + 1; // +1 để bao gồm cả ngày cuối
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays - 1, 'day');
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

/**
 * Custom Hook DUY NHẤT, linh hoạt để quản lý nhiều khối dữ liệu độc lập trên dashboard.
 * @param {string} brandId - ID của thương hiệu.
 * @param {object} filters - Một object chứa các bộ lọc cho từng khối dữ liệu.
 * Ví dụ: { kpi: kpiFilter, lineChart: chartFilter, donut: donutFilter, ... }
 */
export const useDashboardData = (brandId, filters) => {
    // <<< THAY ĐỔI 1: Cấu trúc state mới, mỗi khối dữ liệu là một object riêng >>>
    const [state, setState] = useState({
        kpi: { data: { current: null, previous: null }, loading: true, error: null },
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

    // <<< THAY ĐỔI 2: useEffect riêng cho KPI >>>
    useEffect(() => {
        const filter = filters.kpi;
        if (!brandId || !filter || !filter.range) return;

        const controller = new AbortController();

        const fetchKpi = async () => {
            updateState('kpi', { loading: true, error: null });
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);
            try {
                const [current, previous] = await Promise.all([
                    fetchAsyncData('kpi_summary', brandId, filter.range, {}, controller.signal),
                    fetchAsyncData('kpi_summary', brandId, prevRange, {}, controller.signal)
                ]);
                updateState('kpi', { data: { current, previous }, loading: false });
            } catch (err) {
                if (!axios.isCancel(err)) {
                    updateState('kpi', { error: err.message || 'Lỗi tải dữ liệu KPI.', loading: false });
                }
            }
        };
        
        fetchKpi();

        return () => controller.abort();
    }, [brandId, filters.kpi]); // Chỉ phụ thuộc vào bộ lọc KPI

    // <<< THAY ĐỔI 3: useEffect riêng cho Biểu đồ đường (Line Chart) >>>
    useEffect(() => {
        const filter = filters.lineChart;
        if (!brandId || !filter || !filter.range) return;
        
        const controller = new AbortController();

        const fetchLineChart = async () => {
            updateState('lineChart', { loading: true, error: null });
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);
            try {
                const [currentRes, previousRes] = await Promise.all([
                    fetchAsyncData('daily_kpis_chart', brandId, filter.range, {}, controller.signal),
                    fetchAsyncData('daily_kpis_chart', brandId, prevRange, {}, controller.signal)
                ]);
                const processedCurrent = processChartData(currentRes?.data, filter);
                const processedPrevious = processChartData(previousRes?.data, { range: prevRange, type: filter.type });

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
        fetchLineChart();

        return () => controller.abort();
    }, [brandId, filters.lineChart]); // Chỉ phụ thuộc vào bộ lọc Line Chart

    // <<< THAY ĐỔI 4: useEffect riêng cho các biểu đồ còn lại (Donut, Top Products, Map) >>>
    // Helper function để tránh lặp code
    const createSingleChartEffect = (key, requestType, filter) => {
        useEffect(() => {
            if (!brandId || !filter || !filter.range) return;
            
            const controller = new AbortController();

            const fetchData = async () => {
                updateState(key, { loading: true, error: null });
                try {
                    const result = await fetchAsyncData(requestType, brandId, filter.range, {}, controller.signal);
                    updateState(key, { data: result, loading: false });
                } catch (err) {
                    if (!axios.isCancel(err)) {
                        updateState(key, { error: err.message || `Lỗi tải dữ liệu ${key}.`, loading: false });
                    }
                }
            };

            fetchData();

            return () => controller.abort();
        }, [brandId, filter]);
    };

    createSingleChartEffect('donut', 'kpi_summary', filters.donut);
    createSingleChartEffect('topProducts', 'top_products', filters.topProducts);
    createSingleChartEffect('map', 'customer_map', filters.map);
    
    // Trả về toàn bộ state đã được cấu trúc
    return state;
};