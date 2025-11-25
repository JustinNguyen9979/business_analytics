// FILE: frontend/src/hooks/useTrendLineData.js
import { useState, useEffect } from 'react';
import axios from 'axios';
import { fetchAsyncData } from '../services/api';
import { processChartData } from '../utils/chartDataProcessor';
import { getPreviousPeriod } from '../utils/dateUtils'; // Giả sử có file này, nếu không sẽ tạo

/**
 * Hook chuyên dụng để lấy dữ liệu cho TrendLineChart.
 * @param {string} brandId - ID của thương hiệu.
 * @param {object} filter - Object bộ lọc chứa `range` và `type`.
 */
export const useTrendLineData = (brandId, filter) => {
    const [chartState, setChartState] = useState({
        data: { current: [], previous: [], aggregationType: 'day' },
        loading: true,
        error: null,
    });

    useEffect(() => {
        if (!brandId || !filter || !filter.range) {
            setChartState(prevState => ({ ...prevState, loading: false }));
            return;
        }
        
        const controller = new AbortController();

        const fetchData = async () => {
            setChartState(prevState => ({ ...prevState, loading: true, error: null }));
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);

            try {
                const [currentRes, previousRes] = await Promise.all([
                    fetchAsyncData('daily_kpis_chart', brandId, filter.range, {}, controller.signal),
                    fetchAsyncData('daily_kpis_chart', brandId, prevRange, {}, controller.signal)
                ]);

                // Xử lý cả hai bộ dữ liệu
                const processedCurrent = processChartData(currentRes?.data, filter);
                const processedPrevious = processChartData(previousRes?.data, { range: prevRange, type: filter.type });

                setChartState({
                    data: {
                        current: processedCurrent.aggregatedData,
                        previous: processedPrevious.aggregatedData,
                        aggregationType: processedCurrent.aggregationType,
                    },

                    loading: false,
                    error: null,
                });

            } catch (err) {
                if (!axios.isCancel(err)) {
                    setChartState({
                        data: { current: [], previous: [], aggregationType: 'day' },
                        loading: false,
                        error: err.message || 'Lỗi tải dữ liệu biểu đồ.',
                    });
                }
            }
        };

        fetchData();

        return () => controller.abort();
    }, [brandId, filter]);

    return chartState;
};
