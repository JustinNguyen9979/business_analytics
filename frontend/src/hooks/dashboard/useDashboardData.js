// FILE: frontend/src/hooks/useDashboardData.js

import { useState, useEffect } from 'react';
import { requestData, pollDataStatus } from '../../services/api';
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

// HÀM TIỆN ÍCH FETCH DỮ LIỆU BẤT ĐỒNG BỘ
const fetchAsyncData = async (requestType, brandId, dateRange, params = {}) => {
    const [start, end] = dateRange;
    if (!start || !end) return null;
    const fullParams = { start_date: start.format('YYYY-MM-DD'), end_date: end.format('YYYY-MM-DD'), ...params };
    try {
        const initialResponse = await requestData(requestType, brandId, fullParams);
        if (initialResponse.status === 'SUCCESS') return initialResponse.data;
        if (initialResponse.status === 'PROCESSING') {
            return new Promise((resolve, reject) => {
                const pollingInterval = setInterval(async () => {
                    try {
                        const statusResponse = await pollDataStatus(initialResponse.cache_key);
                        if (statusResponse.status === 'SUCCESS') {
                            clearInterval(pollingInterval);
                            resolve(statusResponse.data);
                        } else if (statusResponse.status === 'FAILED') {
                            clearInterval(pollingInterval);
                            reject(new Error(statusResponse.error || `Worker xử lý '${requestType}' thất bại.`));
                        }
                    } catch (pollError) {
                        clearInterval(pollingInterval);
                        reject(pollError);
                    }
                }, 2000);
            });
        }
        return null;
    } catch (error) {
        console.error(`Lỗi khi fetch ${requestType}:`, error);
        throw error;
    }
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

        const fetchKpi = async () => {
            updateState('kpi', { loading: true, error: null });
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);
            try {
                const [current, previous] = await Promise.all([
                    fetchAsyncData('kpi_summary', brandId, filter.range),
                    fetchAsyncData('kpi_summary', brandId, prevRange)
                ]);
                updateState('kpi', { data: { current, previous }, loading: false });
            } catch (err) {
                updateState('kpi', { error: err.message || 'Lỗi tải dữ liệu KPI.', loading: false });
            }
        };
        fetchKpi();
    }, [brandId, filters.kpi]); // Chỉ phụ thuộc vào bộ lọc KPI

    // <<< THAY ĐỔI 3: useEffect riêng cho Biểu đồ đường (Line Chart) >>>
    useEffect(() => {
        const filter = filters.lineChart;
        if (!brandId || !filter || !filter.range) return;
        
        const fetchLineChart = async () => {
            updateState('lineChart', { loading: true, error: null });
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);
            try {
                const [currentRes, previousRes] = await Promise.all([
                    fetchAsyncData('daily_kpis_chart', brandId, filter.range),
                    fetchAsyncData('daily_kpis_chart', brandId, prevRange)
                ]);
                const processedCurrent = processChartData(currentRes?.data, filter);
                const processedPrevious = processChartData(previousRes?.data, { range: prevRange, type: filter.type });

                // Log tính toán tổng các chỉ số
                // const calculateTotals = (dataArray) => {
                //     if (!dataArray || dataArray.length === 0) {
                //         return { totalRevenue: 0, totalProfit: 0 };
                //     }
                //     return dataArray.reduce((acc, item) => {
                //         acc.totalRevenue += item.netRevenue;
                //         acc.totalProfit += item.profit;
                //         return acc;
                //     }, { totalRevenue: 0, totalProfit: 0 });
                // };

                // const currentTotals = calculateTotals(processedCurrent.aggregatedData);
                // const previousTotals = calculateTotals(processedPrevious.aggregatedData);

                // console.log(`--- [LOG BIỂU ĐỒ - TỔNG KỲ HIỆN TẠI (${processedCurrent.aggregationType})] ---`);
                // console.log('Tổng Doanh thu Ròng:', currentTotals.totalRevenue.toLocaleString('vi-VN'));
                // console.log('Tổng Lợi nhuận:', currentTotals.totalProfit.toLocaleString('vi-VN'));
                
                // console.log(`--- [LOG BIỂU ĐỒ - TỔNG KỲ TRƯỚC (${processedPrevious.aggregationType})] ---`);
                // console.log('Tổng Doanh thu Ròng (Kỳ trước):', previousTotals.totalRevenue.toLocaleString('vi-VN'));
                // console.log('Tổng Lợi nhuận (Kỳ trước):', previousTotals.totalProfit.toLocaleString('vi-VN'));

                updateState('lineChart', { 
                    data: {
                        current: processedCurrent.aggregatedData,
                        previous: processedPrevious.aggregatedData,
                        aggregationType: processedCurrent.aggregationType,
                    }, 
                    loading: false 
                });
            } catch (err) {
                updateState('lineChart', { error: err.message || 'Lỗi tải dữ liệu biểu đồ.', loading: false });
            }
        };
        fetchLineChart();
    }, [brandId, filters.lineChart]); // Chỉ phụ thuộc vào bộ lọc Line Chart

    // <<< THAY ĐỔI 4: useEffect riêng cho các biểu đồ còn lại (Donut, Top Products, Map) >>>
    // Helper function để tránh lặp code
    const createSingleChartEffect = (key, requestType, filter) => {
        useEffect(() => {
            if (!brandId || !filter || !filter.range) return;
            const fetchData = async () => {
                updateState(key, { loading: true, error: null });
                try {
                    const result = await fetchAsyncData(requestType, brandId, filter.range);
                    updateState(key, { data: result, loading: false });
                } catch (err) {
                    updateState(key, { error: err.message || `Lỗi tải dữ liệu ${key}.`, loading: false });
                }
            };
            fetchData();
        }, [brandId, filter]);
    };

    createSingleChartEffect('donut', 'kpi_summary', filters.donut);
    createSingleChartEffect('topProducts', 'top_products', filters.topProducts);
    createSingleChartEffect('map', 'customer_map', filters.map);
    
    // Trả về toàn bộ state đã được cấu trúc
    return state;
};