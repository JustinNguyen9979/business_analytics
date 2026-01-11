// FILE: frontend/src/utils/chartDataProcessor.js (PHIÊN BẢN SỬA LỖI CUỐI CÙNG)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isoWeek from 'dayjs/plugin/isoWeek';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import advancedFormat from 'dayjs/plugin/advancedFormat';

dayjs.extend(isBetween);
dayjs.extend(isoWeek);
dayjs.extend(weekOfYear);
dayjs.extend(advancedFormat);

/**
 * Xác định loại tổng hợp dữ liệu (ngày, tuần, tháng) dựa trên bộ lọc.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month').
 * @param {Array<dayjs>} dateRange - Khoảng thời gian [start, end].
 * @returns {'day' | 'week' | 'month'}
 */
const determineAggregation = (dateRange) => {
    const [start, end] = dateRange;

    if (!start || !end) return 'day';

    // Tính tổng số ngày trong khoảng thời gian, cộng 1 để bao gồm cả ngày cuối.
    const totalDays = end.diff(start, 'day') + 1;

    // Ước tính số tháng. Dùng số ngày trung bình trong tháng (365.25 / 12 = 30.4375)
    const estimatedMonths = totalDays / 30.4375;

    if (estimatedMonths >= 11.5) { // Dùng 11.5 thay vì 12 để account cho sai số nhỏ (ví dụ 11.9x vẫn tính là 12 tháng)
        return 'month'; // Từ ~12 tháng trở lên -> xem theo tháng
    }
    if (estimatedMonths > 2.2) { // Dùng 1.5 thay vì 2 để account cho sai số nhỏ (ví dụ 1.9x vẫn tính là 2 tháng)
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

    // Nếu dữ liệu rỗng (do lọc không ra kết quả), trả về rỗng ngay, không tự điền số 0
    // NHƯNG vẫn phải trả về aggregationType đúng để vẽ trục X
    if (dailyData.length === 0) {
        return { aggregatedData: [], aggregationType };
    }

    // TH1: Không cần tổng hợp, trả về dữ liệu gốc
    if (aggregationType === 'day') {
        return { aggregatedData: dailyData, aggregationType };
    }
    
    // DEBUG: Kiểm tra aggregation
    console.log(`[Processor] Aggregating ${dailyData.length} rows to '${aggregationType}'`);

    const DEFAULT_KEYS = ['net_revenue', 'profit', 'total_cost', 'ad_spend', 'cogs', 'shipping_cost', 'packaging_cost', 'operating_cost', 'other_cost'];

    // Quét toàn bộ dữ liệu để tìm tất cả các key là số
    // LUÔN LUÔN bao gồm các key mặc định để đảm bảo vẽ được biểu đồ ngay cả khi dữ liệu toàn 0
    const numericKeysSet = new Set(DEFAULT_KEYS);
    dailyData.forEach(entry => {
        Object.keys(entry).forEach(key => {
            const val = entry[key];
            if (typeof val === 'number' || (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val)))) {
                numericKeysSet.add(key);
            }
        });
    });
    const numericKeys = Array.from(numericKeysSet);

    // DANH SÁCH CÁC TRƯỜNG CẦN TÍNH TRUNG BÌNH (Thay vì cộng dồn)
    const AVERAGE_KEYS = new Set([
        'avg_repurchase_cycle', 
        'avg_order_value', 
        'retention_rate', 
        'conversion_rate', 
        'roi', 
        'roas',
        'aov',
        'churn_rate'
    ]);

    // TH2: Tổng hợp theo THÁNG (khi xem theo NĂM)
    if (aggregationType === 'month') {
        const monthlyMap = new Map();
        const countMap = new Map(); // Map để đếm số lượng bản ghi cho việc tính trung bình

        // 1. Tạo khung dữ liệu theo tháng, đảm bảo an toàn
        let cursorDate = startDate.clone().startOf('month');
        // let safety = 0;
        while (cursorDate.isBefore(endDate) || cursorDate.isSame(endDate, 'day')) {
            // if (safety++ > 1000) {
            //     console.error("[Processor] Infinite loop detected in MONTH aggregation. Breaking.");
            //     break;
            // }
            const key = cursorDate.format('YYYY-MM');
            const newEntry = { date: cursorDate.toDate() };
            const newCount = {};

            numericKeys.forEach(k => {
                newEntry[k] = 0;
                newCount[k] = 0;
            });

            monthlyMap.set(key, newEntry);
            countMap.set(key, newCount);
            cursorDate = cursorDate.add(1, 'month');
        }

        // 2. Lấp đầy dữ liệu, chỉ cộng vào đúng tháng/năm
        for (const day of dailyData) {
            const key = dayjs(day.date).format('YYYY-MM');
            if (monthlyMap.has(key)) {
                const monthEntry = monthlyMap.get(key);
                const countEntry = countMap.get(key);

                numericKeys.forEach(k => {
                    const val = Number(day[k]);
                    if (!isNaN(val)) {
                        monthEntry[k] += val;
                        if (AVERAGE_KEYS.has(k)) {
                            countEntry[k] += 1;
                        }
                    }
                });
            }
        }

        // 3. Tính lại trung bình cho các key đặc biệt
        monthlyMap.forEach((entry, key) => {
            const countEntry = countMap.get(key);
            numericKeys.forEach(k => {
                if (AVERAGE_KEYS.has(k) && countEntry[k] > 0) {
                    entry[k] = entry[k] / countEntry[k];
                }
            });
        });
        
        return { aggregatedData: Array.from(monthlyMap.values()), aggregationType };
    }

    // TH3: Tổng hợp theo TUẦN (khi xem theo QUÝ hoặc 3+ THÁNG)
    if (aggregationType === 'week') {
        const weeklyMap = new Map();
        const countMap = new Map();
        
        // 3.1. Tạo khung dữ liệu theo tuần
        let cursorDate = startDate.clone().startOf('isoWeek');
        // let safety = 0;
        while (cursorDate.isBefore(endDate) || cursorDate.isSame(endDate, 'day')) {
            // if (safety++ > 1000) {
            //     console.error("[Processor] Infinite loop detected in WEEK aggregation. Breaking.");
            //     break;
            // }
            const key = cursorDate.format('YYYY-MM-DD');
            const newEntry = { date: cursorDate.toDate() };
            const newCount = {};

            numericKeys.forEach(k => {
                newEntry[k] = 0;
                newCount[k] = 0;
            });

            weeklyMap.set(key, newEntry);
            countMap.set(key, newCount);
            cursorDate = cursorDate.add(1, 'week');
        }

        // 3.2. Lấp đầy dữ liệu
        for (const day of dailyData) {
            const weekStartDate = dayjs(day.date).startOf('isoWeek');
            const key = weekStartDate.format('YYYY-MM-DD');
            if (weeklyMap.has(key)) {
                const weekEntry = weeklyMap.get(key);
                const countEntry = countMap.get(key);

                numericKeys.forEach(k => {
                    const val = Number(day[k]);
                    if (!isNaN(val)) {
                        weekEntry[k] += val;
                        if (typeof AVERAGE_KEYS !== 'undefined' && AVERAGE_KEYS.has(k)) {
                             countEntry[k] += 1;
                        }
                    }
                });
            }
        }

        // 3.3. Tính lại trung bình
        weeklyMap.forEach((entry, key) => {
            const countEntry = countMap.get(key);
            numericKeys.forEach(k => {
                if (typeof AVERAGE_KEYS !== 'undefined' && AVERAGE_KEYS.has(k) && countEntry[k] > 0) {
                    entry[k] = entry[k] / countEntry[k];
                }
            });
        });

        return { aggregatedData: Array.from(weeklyMap.values()), aggregationType };
    }
    
    // Trường hợp dự phòng
    return { aggregatedData: dailyData, aggregationType: 'day' };
};