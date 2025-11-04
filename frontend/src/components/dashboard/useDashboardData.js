// FILE: frontend/src/hooks/dashboard/useDashboardData.js (TẠO MỚI)

import { useState, useEffect } from 'react';
import { getBrandDetails, getBrandDailyKpis } from '../../services/api';
import { processChartData } from '../../utils/chartDataProcessor';
import dayjs from 'dayjs';

/**
 * Tính toán khoảng thời gian so sánh dựa trên đơn vị lịch (tháng, quý, năm).
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month', hoặc 'custom').
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */
const getPreviousPeriod = (startDate, endDate, filterType) => {
    if (!startDate || !endDate) return [null, null];

    // Logic 1: Ưu tiên cho các bộ lọc lịch rõ ràng (của biểu đồ)
    if (['year', 'quarter', 'month'].includes(filterType)) {
        const unit = filterType;
        // Tính khoảng thời gian (span). Ví dụ: xem 2 tháng (Mar-Apr) thì span là 2.
        const span = endDate.diff(startDate, unit) + 1;
        
        const prevStartDate = startDate.clone().subtract(span, unit);
        // Để đảm bảo ngày cuối tháng chính xác (ví dụ: tháng 2 có 28/29 ngày)
        const prevEndDate = prevStartDate.clone().add(span, unit).subtract(1, 'day').endOf(unit);
        
        return [prevStartDate.startOf(unit), prevEndDate];
    }

    // Logic 2: Logic dự phòng cho các khoảng thời gian tùy chỉnh (của KPI)
    const durationInDays = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays, 'day');
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

/**
 * Custom Hook để quản lý toàn bộ việc lấy và xử lý dữ liệu cho trang Dashboard.
 * @param {string} brandId - ID của thương hiệu.
 * @param {Array<dayjs>} kpiDateRange - Khoảng thời gian cho KPI.
 * @param {object} chartDateRange - Khoảng thời gian cho Biểu đồ.
 * @returns {object} - Trạng thái và dữ liệu của dashboard.
 */
export const useDashboardData = (brandId, kpiDateRange, chartDateRange) => {
    // State quản lý trạng thái chung
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [brandInfo, setBrandInfo] = useState({ name: '' });

    // State cho dữ liệu KPI
    const [kpiData, setKpiData] = useState({ current: null, previous: null });

    // State cho dữ liệu Biểu đồ
    const [chartData, setChartData] = useState({
        current: [],
        previous: [],
        aggregationType: 'month'
    });

    useEffect(() => {
        const fetchAllData = async () => {
            if (!brandId || !kpiDateRange || !chartDateRange) return;

            setLoading(true);
            setError(null);

            const [kpiStart, kpiEnd] = kpiDateRange;
            const [prevKpiStart, prevKpiEnd] = getPreviousPeriod(kpiStart, kpiEnd, 'custom');
            
            const [chartStart, chartEnd] = chartDateRange.range;
            const [prevChartStart, prevChartEnd] = getPreviousPeriod(chartStart, chartEnd, chartDateRange.type);

            try {
                const [
                    kpiResponse, 
                    prevKpiResponse, 
                    chartResponse, 
                    prevChartResponse
                ] = await Promise.all([
                    getBrandDetails(brandId, kpiStart, kpiEnd),
                    getBrandDetails(brandId, prevKpiStart, prevKpiEnd),
                    getBrandDailyKpis(brandId, chartStart, chartEnd),
                    getBrandDailyKpis(brandId, prevChartStart, prevChartEnd)
                ]);

                // Xử lý và cập nhật dữ liệu KPI
                if (kpiResponse) setBrandInfo({ id: kpiResponse.id, name: kpiResponse.name });
                setKpiData({
                    current: kpiResponse ? kpiResponse.kpis : null,
                    previous: prevKpiResponse ? prevKpiResponse.kpis : null
                });

                // Xử lý và cập nhật dữ liệu Biểu đồ
                const processedCurrent = processChartData(chartResponse, chartDateRange);
                const prevChartDateRange = { range: [prevChartStart, prevChartEnd], type: chartDateRange.type };
                const processedPrevious = processChartData(prevChartResponse, prevChartDateRange);

                setChartData({
                    current: processedCurrent.aggregatedData,
                    previous: processedPrevious.aggregatedData,
                    aggregationType: processedCurrent.aggregationType
                });

            } catch (err) {
                setError("Không thể tải dữ liệu.");
                console.error("Lỗi khi fetch:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchAllData();
    }, [brandId, kpiDateRange, chartDateRange]); // Hook sẽ chạy lại khi các giá trị này thay đổi

    // Trả về tất cả state và dữ liệu cần thiết cho component UI
    return { loading, error, brandInfo, kpiData, chartData };
};