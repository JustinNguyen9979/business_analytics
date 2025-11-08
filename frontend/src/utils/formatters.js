// FILE: frontend/src/utils/formatters.js (TẠO MỚI)

/**
 * Định dạng một số thành chuỗi tiền tệ Việt Nam (VNĐ).
 * @param {number} value - Số cần định dạng.
 * @returns {string} Chuỗi đã định dạng, ví dụ: "1.234.567 đ".
 */
export const formatCurrency = (value) => {
    // Thêm kiểm tra an toàn để tránh lỗi
    if (typeof value !== 'number' || !isFinite(value)) {
        return '0 đ';
    }
    return Math.round(value).toLocaleString('vi-VN') + ' đ';
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