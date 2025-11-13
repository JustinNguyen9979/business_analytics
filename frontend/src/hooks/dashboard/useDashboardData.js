// FILE: frontend/src/hooks/useDashboardData.js

import { useState, useEffect } from 'react';
import { requestData, pollDataStatus } from '../../services/api';
import dayjs from 'dayjs';
import { processChartData } from '../../utils/chartDataProcessor';

/**
 * TÍNH TOÁN KHOẢNG THỜI GIAN SO SÁNH THÔNG MINH
 */
const getPreviousPeriod = (startDate, endDate, filterType = 'custom') => {
    if (!startDate || !endDate) return [null, null];

    if (['year', 'month', 'week'].includes(filterType)) {
        const prevStartDate = startDate.clone().subtract(1, filterType);
        const prevEndDate = prevStartDate.clone().endOf(filterType);
        return [prevStartDate, prevEndDate];
    }

    const durationInDays = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays, 'day');
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
 * Custom Hook DUY NHẤT để quản lý toàn bộ việc lấy và xử lý dữ liệu cho trang Dashboard.
 */
export const useDashboardData = (brandId, kpiFilter, chartFilter) => {
    const [data, setData] = useState({
        kpi: { current: null, previous: null },
        chart: { current: [], previous: [], aggregationType: 'day' },
        donut: null,
        topProducts: null,
        map: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!brandId || !kpiFilter || !kpiFilter.range || !chartFilter) return;

        const fetchAllDashboardData = async () => {
            setLoading(true);
            setError(null);

            // Tính toán các khoảng thời gian so sánh
            const prevKpiRange = getPreviousPeriod(kpiFilter.range[0], kpiFilter.range[1], kpiFilter.type);
            const prevChartRange = getPreviousPeriod(chartFilter.range[0], chartFilter.range[1], chartFilter.type);

            try {
                // Gọi tất cả các API song song
                const [
                    kpiCurrent, kpiPrevious,
                    chartApiResponse, prevChartApiResponse,
                    donutData, topProductsData, mapData,
                ] = await Promise.all([
                    // Dữ liệu KPI (dùng kpiFilter)
                    fetchAsyncData('kpi_summary', brandId, kpiFilter.range),
                    fetchAsyncData('kpi_summary', brandId, prevKpiRange),
                    // Dữ liệu biểu đồ đường (dùng chartFilter.range)
                    fetchAsyncData('daily_kpis_chart', brandId, chartFilter.range),
                    fetchAsyncData('daily_kpis_chart', brandId, prevChartRange),
                    // Dữ liệu cho các biểu đồ còn lại (cũng dùng chartFilter.range)
                    fetchAsyncData('kpi_summary', brandId, chartFilter.range), // Donut
                    fetchAsyncData('top_products', brandId, chartFilter.range),
                    fetchAsyncData('customer_map', brandId, chartFilter.range),
                ]);

                // Xử lý dữ liệu biểu đồ đường
                const processedCurrentChart = processChartData(chartApiResponse?.data, chartFilter);
                const processedPreviousChart = processChartData(prevChartApiResponse?.data, { range: prevChartRange, type: chartFilter.type });

                // Cập nhật state một lần duy nhất với tất cả dữ liệu
                setData({
                    kpi: { current: kpiCurrent, previous: kpiPrevious },
                    chart: {
                        current: processedCurrentChart.aggregatedData,
                        previous: processedPreviousChart.aggregatedData,
                        aggregationType: processedCurrentChart.aggregationType,
                    },
                    donut: donutData,
                    topProducts: topProductsData,
                    map: mapData,
                });

            } catch (err) {
                setError(err.message || 'Đã xảy ra lỗi khi tải dữ liệu dashboard.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchAllDashboardData();
    }, [brandId, kpiFilter, chartFilter]); // Chạy lại mỗi khi các bộ lọc thay đổi

    return { data, loading, error };
};