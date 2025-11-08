// FILE: frontend/src/hooks/useChartData.js (TẠO MỚI)

import { useState, useEffect } from 'react';
import { getBrandDailyKpis } from '../services/api';
import { processChartData } from '../utils/chartDataProcessor';
import dayjs from 'dayjs';

/**
 * Tính toán khoảng thời gian so sánh dựa trên đơn vị lịch (tháng, quý, năm).
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month', hoặc 'custom').
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */
const getPreviousPeriodForChart = (startDate, endDate, filterType) => {
    if (!startDate || !endDate) return [null, null];

    if (['year', 'quarter', 'month'].includes(filterType)) {
        const unit = filterType;
        const span = endDate.diff(startDate, unit) + 1;
        const prevStartDate = startDate.clone().subtract(span, unit);
        const prevEndDate = prevStartDate.clone().add(span, unit).subtract(1, 'day').endOf(unit);
        return [prevStartDate.startOf(unit), prevEndDate];
    }
    
    // Logic dự phòng cho trường hợp khác
    const durationInDays = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays, 'day');
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};


/**
 * Custom Hook để quản lý việc lấy dữ liệu cho biểu đồ Doanh thu & Lợi nhuận.
 * @param {string} brandId - ID của thương hiệu.
 * @param {object} dateRangeConfig - Object chứa khoảng thời gian và loại bộ lọc.
 * @returns {object} - Trạng thái và dữ liệu của biểu đồ.
 */
export const useChartData = (brandId, dateRangeConfig) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chartData, setChartData] = useState({
        current: [],
        previous: [],
        aggregationType: 'month'
    });

    useEffect(() => {
        const fetchData = async () => {
            if (!brandId || !dateRangeConfig) return;

            setLoading(true);
            setError(null);

            const { range, type } = dateRangeConfig;
            const [chartStart, chartEnd] = range;
            const [prevChartStart, prevChartEnd] = getPreviousPeriodForChart(chartStart, chartEnd, type);
            
            try {
                // Chỉ gọi các API liên quan đến biểu đồ
                const [chartResponse, prevChartResponse] = await Promise.all([
                    getBrandDailyKpis(brandId, chartStart, chartEnd),
                    getBrandDailyKpis(brandId, prevChartStart, prevChartEnd)
                ]);

                const processedCurrent = processChartData(chartResponse, dateRangeConfig);
                const prevChartDateRange = { range: [prevChartStart, prevChartEnd], type: type };
                const processedPrevious = processChartData(prevChartResponse, prevChartDateRange);

                setChartData({
                    current: processedCurrent.aggregatedData,
                    previous: processedPrevious.aggregatedData,
                    aggregationType: processedCurrent.aggregationType
                });

            } catch (err) {
                setError("Không thể tải dữ liệu biểu đồ.");
                console.error("Lỗi khi fetch Chart data:", err);
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [brandId, dateRangeConfig]); // Hook chỉ chạy lại khi brandId hoặc dateRange của Chart thay đổi

    return { loading, error, chartData };
};