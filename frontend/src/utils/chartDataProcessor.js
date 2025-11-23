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
const determineAggregation = (dateRange) => {
    const [start, end] = dateRange;

    // Tính tổng số ngày trong khoảng thời gian, cộng 1 để bao gồm cả ngày cuối.
    const totalDays = end.diff(start, 'day') + 1;

    // Ước tính số tháng. Dùng số ngày trung bình trong tháng (365.25 / 12 = 30.4375)
    const estimatedMonths = totalDays / 30.4375;

    if (estimatedMonths >= 11.5) { // Dùng 11.5 thay vì 12 để account cho sai số nhỏ (ví dụ 11.9x vẫn tính là 12 tháng)
        return 'month'; // Từ ~12 tháng trở lên -> xem theo tháng
    }
    if (estimatedMonths >= 1.5) { // Dùng 1.5 thay vì 2 để account cho sai số nhỏ (ví dụ 1.9x vẫn tính là 2 tháng)
        return 'week';  // Từ ~2 tháng đến dưới ~12 tháng -> xem theo tuần
    }
    return 'day';       // Dưới ~2 tháng -> xem theo ngày
};

/**
 * Xử lý và tổng hợp dữ liệu biểu đồ.
 * @param {Array<Object>} dailyData - Dữ liệu thô hàng ngày từ API.
 * @param {object} chartDateRange - Object bộ lọc { range, type }.
 * @returns {{ aggregatedData: Array<Object>, aggregationType: string }}
 */
export const processChartData = (dailyData, chartDateRange) => {
    // Các điều kiện an toàn
    if (!dailyData || !chartDateRange?.range) {
        return { aggregatedData: [], aggregationType: 'day' };
    }

    const { range } = chartDateRange; // Chỉ cần range
    const [startDate, endDate] = range;
    const aggregationType = determineAggregation(range); // Gọi hàm đã sửa đổi

    // TH1: Không cần tổng hợp, trả về dữ liệu gốc
    if (aggregationType === 'day') {
        return { aggregatedData: dailyData, aggregationType };
    }

    // TH2: Tổng hợp theo THÁNG (khi xem theo NĂM)
    if (aggregationType === 'month') {
        const monthlyMap = new Map();

        // 1. Tạo khung dữ liệu theo tháng, đảm bảo an toàn
        let cursorDate = startDate.clone().startOf('month');
        while (cursorDate.isBefore(endDate) || cursorDate.isSame(endDate, 'day')) {
            const key = cursorDate.format('YYYY-MM');
            monthlyMap.set(key, {
                date: cursorDate.toDate(),
                netRevenue: 0,
                profit: 0,
            });
            cursorDate = cursorDate.add(1, 'month');
        }

        // 2. Lấp đầy dữ liệu, chỉ cộng vào đúng tháng/năm
        for (const day of dailyData) {
            const key = dayjs(day.date).format('YYYY-MM');
            if (monthlyMap.has(key)) {
                const monthEntry = monthlyMap.get(key);
                monthEntry.netRevenue += day.netRevenue;
                monthEntry.profit += day.profit;
            }
        }
        return { aggregatedData: Array.from(monthlyMap.values()), aggregationType };
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