// FILE: frontend/src/utils/formatters.js (TẠO MỚI)
import dayjs from 'dayjs';

/**
 * Định dạng ngày tháng (YYYY-MM-DD hoặc Date object) sang 'DD/MM/YYYY'.
 * @param {string|Date} date - Ngày cần định dạng.
 * @returns {string} Chuỗi ngày đã định dạng.
 */
export const formatDate = (date) => {
    if (!date) return '---';
    return dayjs(date).format('DD/MM/YYYY');
};

/**
 * Định dạng một số thành chuỗi tiền tệ Việt Nam (VNĐ).
 * @param {number} value - Số cần định dạng.
 * @returns {string} Chuỗi đã định dạng, ví dụ: "1.234.567 đ".
 */
export const formatCurrency = (value) => {
    // Thêm kiểm tra an toàn để tránh lỗi
    if (typeof value !== 'number' || !isFinite(value)) {
        return '0đ';
    }
    return Math.round(value).toLocaleString('vi-VN') + 'đ';
};

/**
 * Định dạng một số thành chuỗi số có dấu phân cách hàng nghìn.
 * @param {number} value - Số cần định dạng.
 * @returns {string} Chuỗi đã định dạng, ví dụ: "1.234.567".
 */
export const formatNumber = (value) => {
    // Thêm kiểm tra an toàn
    if (typeof value !== 'number' || !isFinite(value)) {
        return '0';
    }
    return Math.round(value).toLocaleString('vi-VN');
};

/**
 * Định dạng một số thành chuỗi phần trăm.
 * @param {number} value - Số cần định dạng (ví dụ: 0.15 cho 15%).
 * @returns {string} Chuỗi đã định dạng, ví dụ: "15.00%".
 */
export const formatPercentage = (value, options = {}) => {
    if (typeof value !== 'number' || !isFinite(value)) {
        return '0.00%';
    }
    
    let finalValue = value * 100;

    // Nếu includeSign = false, ta lấy trị tuyệt đối để không hiện dấu âm
    // (Thường dùng khi đã có icon mũi tên chỉ hướng tăng/giảm)
    if (options.includeSign === false) {
        finalValue = Math.abs(finalValue);
    }

    return finalValue.toFixed(2) + '%';
};