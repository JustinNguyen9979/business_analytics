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
const calculateFinancialMetrics = (allRevenues, allOrders, allProducts, dateRange) => {
    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate || !allRevenues) {
        return { gmv: 0, netRevenue: 0, executionCost: 0, cogs: 0 };
    }

    const checkDate = (date) => {
        const d = dayjs(date);
        return !d.isBefore(startDate, 'day') && !d.isAfter(endDate, 'day');
    };

    const filteredRevenues = allRevenues.filter(r => checkDate(r.transaction_date));

    // 1. Tính GMV và Doanh thu Ròng từ các cột cốt lõi
    const gmv = filteredRevenues.reduce((sum, r) => sum + (r.gmv || 0), 0);
    const netRevenue = filteredRevenues.reduce((sum, r) => sum + (r.net_revenue || 0), 0);

    // 2. TÍNH CHI PHÍ THỰC THI TỪ CÁC CHI TIẾT GIAO DỊCH
    const executionCost = filteredRevenues.reduce((sum, r) => {
        const details = r.details || {};
        
        // Lấy giá trị gốc (âm/dương) từ details và cộng dồn
        const transactionCosts = 
            parseFloat(details['Số tiền hoàn lại'] || 0) +
            parseFloat(details['Phí vận chuyển Người mua trả'] || 0) +
            parseFloat(details['Phí vận chuyển thực tế'] || 0) +
            parseFloat(details['Phí vận chuyển được trợ giá từ Shopee'] || 0) +
            parseFloat(details['Mã ưu đãi do Người Bán chịu'] || 0) +
            parseFloat(details['Phí cố định'] || 0) +
            parseFloat(details['Phí Dịch Vụ'] || 0) +
            parseFloat(details['Phí thanh toán'] || 0) +
            parseFloat(details['Phí trả hàng cho người bán'] || 0) +
            parseFloat(details['Phí trả hàng'] || 0) +
            parseFloat(details['Phí vận chuyển được hoàn bởi PiShip'] || 0) +
            parseFloat(details['Phí dịch vụ PiShip'] || 0) +
            parseFloat(details['Phí hoa hồng Tiếp thị liên kết'] || 0);
            
        return sum + transactionCosts;
    }, 0);

    // Tính giá vốn hàng bán (COGS)
    const productCostMap = new Map();
    allProducts.forEach(p => {
        productCostMap.set(p.sku, p.cost_price || 0);
    });

    // 3.2. Lấy danh sách các `order_code` duy nhất từ các giao dịch doanh thu đã lọc
    const orderCodesInPeriod = new Set(filteredRevenues.map(r => r.order_code));

    // 3.3. Lọc ra tất cả các dòng trong bảng `orders` khớp với các `order_code` ở trên
    // và chỉ lấy các đơn không bị hủy
    const relevantOrders = allOrders.filter(o => 
        orderCodesInPeriod.has(o.order_code) && o.status !== 'Đã hủy'
    );

    // 3.4. Tính tổng giá vốn
    const cogs = relevantOrders.reduce((sum, order) => {
        // Tra cứu giá vốn của SKU trong đơn hàng
        const costPrice = productCostMap.get(order.sku) || 0;
        // Nhân với số lượng và cộng dồn
        return sum + (costPrice * (order.quantity || 0));
    }, 0);
    
    // 3. Trả về một object chứa tất cả các giá trị
    return { gmv, netRevenue, executionCost, cogs };
}


// --- HÀM TÍNH TOÁN KPI TỔNG ---
export const calculateAllKpis = (brandData, dateRange) => {
    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate || !brandData) {
        return { gmv: 0, netRevenue: 0, executionCost: 0 };
    }

    const allRevenues = brandData.revenues || [];
    const allOrders = brandData.orders || [];
    const allProducts = brandData.products || [];
    
    // Gọi hàm chuyên biệt để lấy các chỉ số tài chính
    const { gmv, netRevenue, executionCost, cogs } = calculateFinancialMetrics(allRevenues, allOrders, allProducts, dateRange);

    // TÍNH TOÁN CÁC CHỈ SỐ PHỤ THUỘC
    const adSpend = 0; // Sẽ tính sau
    const totalCost = cogs + adSpend + Math.abs(executionCost);
    const profit = netRevenue - totalCost;

    // Tính ROI, tỷ xuất lợi nhuận trên chi phí
    const roi = ( profit / totalCost ) * 100;
    const profitMargin = ( profit / netRevenue ) * 100;
    const takeRate = ( Math.abs(executionCost) / gmv ) * 100;

    // --- TRẢ VỀ KẾT QUẢ ---
    return {
        gmv,
        netRevenue,
        executionCost,
        cogs,
        totalCost,
        profit,
        roi,
        profitMargin,
        takeRate,
    };
};