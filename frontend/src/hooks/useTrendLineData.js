// FILE: frontend/src/hooks/useTrendLineData.js
import { useState, useEffect } from 'react';
import axios from 'axios';
import { fetchAsyncData } from '../services/api';
import { processChartData, determineAggregation } from '../utils/chartDataProcessor';
import { getPreviousPeriod } from '../utils/dateUtils'; 

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
            
            // 1. Tính toán trước interval cần thiết (Backend Aggregation)
            const interval = determineAggregation(filter.range);
            const prevRange = getPreviousPeriod(filter.range[0], filter.range[1], filter.type);

            try {
                // 2. Gửi request kèm param interval
                const [currentRes, previousRes] = await Promise.all([
                    fetchAsyncData('daily_kpis_chart', brandId, filter.range, { interval }, controller.signal),
                    fetchAsyncData('daily_kpis_chart', brandId, prevRange, { interval }, controller.signal)
                ]);

                // 3. Xử lý kết quả trả về
                // Backend trả về: { data: [...], aggregationType: '...' }
                // Nếu Backend chưa support (cũ), nó trả về { data: [...] } -> processChartData sẽ fallback tự tính
                const currentDataRaw = currentRes?.data || [];
                const currentAggType = currentRes?.aggregationType || null;
                
                const prevDataRaw = previousRes?.data || [];
                const prevAggType = previousRes?.aggregationType || null;

                const processedCurrent = processChartData(currentDataRaw, filter, currentAggType);
                
                // Kỳ trước cũng dùng chung interval type để đồng bộ trục X
                const processedPrevious = processChartData(prevDataRaw, { range: prevRange, type: filter.type }, prevAggType);

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
