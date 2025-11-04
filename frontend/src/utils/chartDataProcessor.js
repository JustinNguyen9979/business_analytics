// FILE: frontend/src/utils/chartDataProcessor.js (PHIÊN BẢN SỬA LỖI CUỐI CÙNG)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

/**
 * Xác định loại tổng hợp dữ liệu (ngày, tuần, tháng) dựa trên bộ lọc.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month').
 * @param {Array<dayjs>} dateRange - Khoảng thời gian [start, end].
 * @returns {'day' | 'week' | 'month'}
 */
const determineAggregation = (filterType, dateRange) => {
    if (filterType === 'year') {
        return 'month';
    }
    if (filterType === 'quarter') {
        return 'week';
    }
    if (filterType === 'month') {
        const [start, end] = dateRange;
        const monthSpan = end.diff(start, 'month') + 1;
        return monthSpan >= 3 ? 'week' : 'day';
    }
    return 'day';
};

/**
 * Xử lý và tổng hợp dữ liệu biểu đồ.
 * @param {Array<Object>} dailyData - Dữ liệu thô hàng ngày từ API.
 * @param {object} chartDateRange - Object bộ lọc { range, type }.
 * @returns {{ aggregatedData: Array<Object>, aggregationType: string }}
 */
export const processChartData = (dailyData, chartDateRange) => {
    // Các điều kiện an toàn
    if (!dailyData || !chartDateRange?.range || !chartDateRange?.type) {
        return { aggregatedData: [], aggregationType: 'day' };
    }

    const { range, type } = chartDateRange;
    const [startDate, endDate] = range;
    const aggregationType = determineAggregation(type, range);

    // TH1: Không cần tổng hợp, trả về dữ liệu gốc
    if (aggregationType === 'day') {
        return { aggregatedData: dailyData, aggregationType };
    }

    // TH2: Tổng hợp theo THÁNG (khi xem theo NĂM) - THUẬT TOÁN MỚI
    if (aggregationType === 'month') {
        // 2.1. Tạo 12 "xô" rỗng, mỗi xô cho một tháng
        const monthlyBuckets = Array.from({ length: 12 }, (_, i) => ({
            date: startDate.clone().month(i).startOf('month').toDate(),
            netRevenue: 0,
            profit: 0,
        }));

        // 2.2. Đổ dữ liệu hàng ngày vào đúng "xô" tháng của nó
        for (const day of dailyData) {
            const monthIndex = dayjs(day.date).month(); // Lấy chỉ số tháng (0-11)
            if (monthlyBuckets[monthIndex]) { // Kiểm tra an toàn
                monthlyBuckets[monthIndex].netRevenue += day.netRevenue;
                monthlyBuckets[monthIndex].profit += day.profit;
            }
        }
        return { aggregatedData: monthlyBuckets, aggregationType };
    }

    // TH3: Tổng hợp theo TUẦN (khi xem theo QUÝ hoặc 3+ THÁNG)
    if (aggregationType === 'week') {
        const weeklyMap = new Map();
        
        // 3.1. Tạo khung dữ liệu theo tuần
        let cursorDate = startDate.clone().startOf('week');
        while (cursorDate.isBefore(endDate) || cursorDate.isSame(endDate, 'day')) {
            const key = cursorDate.format('YYYY-MM-DD');
            weeklyMap.set(key, {
                date: cursorDate.toDate(),
                netRevenue: 0,
                profit: 0,
            });
            cursorDate = cursorDate.add(1, 'week');
        }

        // 3.2. Lấp đầy dữ liệu
        for (const day of dailyData) {
            const weekStartDate = dayjs(day.date).startOf('week');
            const key = weekStartDate.format('YYYY-MM-DD');
            if (weeklyMap.has(key)) {
                const weekEntry = weeklyMap.get(key);
                weekEntry.netRevenue += day.netRevenue;
                weekEntry.profit += day.profit;
            }
        }
        return { aggregatedData: Array.from(weeklyMap.values()), aggregationType };
    }
    
    // Trường hợp dự phòng
    return { aggregatedData: dailyData, aggregationType: 'day' };
};