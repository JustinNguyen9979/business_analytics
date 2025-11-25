// FILE: frontend/src/utils/dateUtils.js
import dayjs from 'dayjs';

/**
 * TÍNH TOÁN KHOẢNG THỜI GIAN SO SÁNH THÔNG MINH
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @param {string} filterType - Loại bộ lọc ('year', 'quarter', 'month', 'custom').
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */
export const getPreviousPeriod = (startDate, endDate, filterType = 'custom') => {
    if (!startDate || !endDate) return [null, null];

    // 1. Xử lý trường hợp "Tháng hiện tại" (this_month)
    if (filterType === 'this_month') {
        const dayOfMonth = endDate.date();
        const prevMonthStartDate = startDate.clone().subtract(1, 'month');
        let prevMonthEndDate = prevMonthStartDate.clone().date(dayOfMonth);

        if (prevMonthEndDate.month() !== prevMonthStartDate.month()) {
            prevMonthEndDate = prevMonthStartDate.clone().endOf('month');
        }
        return [prevMonthStartDate, prevMonthEndDate];
    }

    // 2. Xử lý các bộ lọc có khoảng thời gian cố định theo lịch (nguyên tháng, quý, năm)
    if (['this_year', 'last_month', 'year', 'quarter', 'month'].includes(filterType) || (typeof filterType === 'string' && filterType.startsWith('Quý'))) {
        const durationInMonths = endDate.diff(startDate, 'month') + 1;
        const prevStartDate = startDate.clone().subtract(durationInMonths, 'month');
        const prevEndDate = startDate.clone().subtract(1, 'day');
        return [prevStartDate.startOf('month'), prevEndDate.endOf('day')];
    }
    
    // 3. Logic mặc định cho các khoảng ngày tùy chỉnh
    const durationInDays = endDate.diff(startDate, 'day') + 1;
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays - 1, 'day');

    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};
