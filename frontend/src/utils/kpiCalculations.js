// FILE: frontend/src/utils/kpiCalculations.js (PHIÊN BẢN SỰ THẬT DUY NHẤT)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

// --- CÁC HÀM HỖ TRỢ ĐỊNH DẠNG SỐ LIỆU (giữ nguyên) ---
export const formatCurrency = (value) => {
    // if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
    return value.toLocaleString('vi-VN') + ' đ';
};

export const formatNumber = (value) => {
    return value.toLocaleString('vi-VN');
};

// --- HÀM TÍNH TOÁN KPI ---
export const calculateAllKpis = (brandData, dateRange) => {
    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate || !brandData) {
        return { gmv: 0, netRevenue: 0 };
    }

    const allRevenues = brandData.revenues || [];

    const checkDate = (date) => {
        const d = dayjs(date);
        return !d.isBefore(startDate, 'day') && !d.isAfter(endDate, 'day');
    };

    const filteredRevenues = allRevenues.filter(r => checkDate(r.payment_completed_date));

    // --- CÔNG THỨC TÍNH TOÁN SIÊU ĐƠN GIẢN ---
    
    // 1. GMV = TỔNG CỦA CỘT `product_price` (đã bao gồm các giá trị âm nếu có)
    const gmv = filteredRevenues.reduce((sum, r) => sum + (r.product_price || 0), 0);

    // 2. DOANH THU RÒNG = TỔNG CỦA CỘT `total_payment` (đã bao gồm các giá trị âm nếu có)
    const netRevenue = filteredRevenues.reduce((sum, r) => sum + (r.total_payment || 0), 0);
    
    // --- TRẢ VỀ KẾT QUẢ ---
    return {
        gmv,        
        netRevenue, 
    };
};