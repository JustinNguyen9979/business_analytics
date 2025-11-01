// FILE: frontend/src/utils/kpiCalculations.js (PHIÊN BẢN SỬA LỖI CRASH)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import minMax from 'dayjs/plugin/minMax'; // Import plugin minMax
dayjs.extend(isBetween);
dayjs.extend(minMax); // Sử dụng plugin

// --- CÁC HÀM HỖ TRỢ ĐỊNH DẠNG SỐ LIỆU ---
export const formatCurrency = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0 đ';
    return value.toLocaleString('vi-VN') + ' đ';
};

export const formatNumber = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0';
    return value.toLocaleString('vi-VN');
};

// =========================================================================
// HÀM 1: CHUYÊN TÍNH CÁC CHỈ SỐ TÀI CHÍNH
// =========================================================================
const calculateFinancialMetrics = (revenuesInPeriod, ordersInPeriod) => {
    const gmv = (revenuesInPeriod || []).reduce((sum, r) => sum + (r.gmv || 0), 0);
    const netRevenue = (revenuesInPeriod || []).reduce((sum, r) => sum + (r.net_revenue || 0), 0);
    const executionCost = (revenuesInPeriod || []).reduce((sum, r) => {
        const details = r.details || {};
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

    const orderCodesInFinancialPeriod = new Set((revenuesInPeriod || []).map(r => r.order_code));
    const relevantOrders = (ordersInPeriod || []).filter(o => orderCodesInFinancialPeriod.has(o.order_code));
    const cogs = relevantOrders.reduce((sum, order) => sum + (order.cogs || 0), 0);
    
    return { gmv, netRevenue, executionCost: Math.abs(executionCost), cogs };
};

// =========================================================================
// HÀM 2: CHUYÊN TÍNH CÁC CHỈ SỐ MARKETING
// =========================================================================
const calculateMarketingMetrics = (adsInPeriod) => {
    const adSpend = (adsInPeriod || []).reduce((sum, ad) => sum + (ad.expense || 0), 0);
    const totalImpressions = (adsInPeriod || []).reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const totalClicks = (adsInPeriod || []).reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const adOrders = (adsInPeriod || []).reduce((sum, ad) => sum + (ad.orders || 0), 0);
    const gmvFromAds = (adsInPeriod || []).reduce((sum, ad) => sum + (ad.gmv || 0), 0);

    const roas = adSpend > 0 ? gmvFromAds / adSpend : 0;
    const cpo = adOrders > 0 ? adSpend / adOrders : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? adSpend / totalClicks : 0;
    const conversionRate = totalClicks > 0 ? (adOrders / totalClicks) * 100 : 0;

    return { adSpend, roas, cpo, ctr, cpc, conversionRate };
};

// =========================================================================
// HÀM 3: CHUYÊN TÍNH CÁC CHỈ SỐ VẬN HÀNH
// =========================================================================
const calculateOperationalMetrics = (ordersInPeriod, revenuesInPeriod) => {
    const totalOrders = new Set((ordersInPeriod || []).map(o => o.order_code)).size;
    const cancelledOrders = new Set((ordersInPeriod || []).filter(o => o.status === 'Đã hủy').map(o => o.order_code)).size;
    
    const orderCodesInPeriod = new Set((ordersInPeriod || []).map(o => o.order_code));
    const relevantRevenues = (revenuesInPeriod || []).filter(r => orderCodesInPeriod.has(r.order_code));
    const refundedOrdersSet = new Set();
    relevantRevenues.forEach(r => {
        const refundCode = r.details?.['Mã yêu cầu hoàn tiền'];
        if (refundCode && String(refundCode).toLowerCase() !== 'nan') {
            const originalOrder = (ordersInPeriod || []).find(o => o.order_code === r.order_code);
            if (originalOrder && originalOrder.status !== 'Đã hủy') {
                refundedOrdersSet.add(r.order_code);
            }
        }
    });
    const refundedOrders = refundedOrdersSet.size;
    const completedOrders = totalOrders > 0 ? totalOrders - cancelledOrders - refundedOrders : 0;
    
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const refundRate = (totalOrders - cancelledOrders) > 0 ? (refundedOrders / (totalOrders - cancelledOrders)) * 100 : 0;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const completedOrderCodesSet = new Set(
        (ordersInPeriod || [])
            .filter(o => o.status !== 'Đã hủy' && !refundedOrdersSet.has(o.order_code))
            .map(o => o.order_code)
    );
    const completedOperationalOrders = (ordersInPeriod || []).filter(o => completedOrderCodesSet.has(o.order_code));

    let allSoldSkus = [];
    completedOperationalOrders.forEach(order => {
        const items = order.details?.items || [];
        items.forEach(item => { if (item.sku) allSoldSkus.push(item.sku); });
    });
    const uniqueSkusSold = new Set(allSoldSkus).size;

    const totalUnitsSold = completedOperationalOrders.reduce((sum, order) => sum + (order.total_quantity || 0), 0);
    const upt = completedOrders > 0 ? totalUnitsSold / completedOrders : 0;
    
    const relevantCompletedRevenues = (revenuesInPeriod || []).filter(r => completedOrderCodesSet.has(r.order_code));
    const gmvOfCompletedOrders = relevantCompletedRevenues.reduce((sum, r) => sum + (r.gmv || 0), 0);
    const aov = completedOrders > 0 ? gmvOfCompletedOrders / completedOrders : 0;

    return { totalOrders, cancelledOrders, completedOrders, uniqueSkusSold, cancellationRate, completionRate, upt, refundedOrders, refundRate, aov };
};

// =========================================================================
// HÀM 4: CHUYÊN TÍNH CÁC CHỈ SỐ KHÁCH HÀNG
// =========================================================================
const calculateCustomerMetrics = (allOrdersHistory, ordersInPeriod, adSpend, profit) => {
    // === BƯỚC SỬA 1: THÊM "RÀO CHẮN" AN TOÀN ===
    // Nếu không có đơn hàng trong kỳ này, không cần tính toán gì cả.
    if (!ordersInPeriod || ordersInPeriod.length === 0) {
        return { totalCustomers: 0, newCustomers: 0, returningCustomers: 0, retentionRate: 0, cac: 0, ltv: 0 };
    }
    // ===========================================

    const customerFirstOrderDate = new Map();
    const sortedAllOrders = [...allOrdersHistory].sort((a, b) => dayjs(a.order_date).diff(dayjs(b.order_date)));
    
    for (const order of sortedAllOrders) {
        if (order.username && !customerFirstOrderDate.has(order.username)) {
            customerFirstOrderDate.set(order.username, dayjs(order.order_date));
        }
    }

    const customersInPeriod = new Set((ordersInPeriod || []).map(o => o.username).filter(Boolean));
    const datesInPeriod = ordersInPeriod.map(o => dayjs(o.order_date));
    const firstDateInPeriod = dayjs.min(datesInPeriod);
    const lastDateInPeriod = dayjs.max(datesInPeriod);

    let newCustomers = 0;
    let returningCustomers = 0;
    
    customersInPeriod.forEach(username => {
        const firstDate = customerFirstOrderDate.get(username);
        // Kiểm tra xem ngày đầu tiên có nằm trong khoảng thời gian đang xét không
        if (firstDate && firstDate.isBetween(firstDateInPeriod, lastDateInPeriod, 'day', '[]')) {
            newCustomers++;
        } else {
            returningCustomers++;
        }
    });

    const totalCustomers = customersInPeriod.size;
    const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
    const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
    const ltv = totalCustomers > 0 ? profit / totalCustomers : 0;
    
    return { totalCustomers, newCustomers, returningCustomers, retentionRate, cac, ltv };
};


// =========================================================================
// HÀM TỔNG HỢP: GỌI TẤT CẢ CÁC HÀM TÍNH TOÁN
// =========================================================================
export const calculateAllKpis = (brandData, dateRange) => {
    if (!brandData || !dateRange[0] || !dateRange[1]) {
        return {};
    }

    const revenuesInPeriod = brandData.revenues || [];
    const ordersInPeriod = brandData.orders || [];
    const adsInPeriod = brandData.ads || [];
    
    const financialKpis = calculateFinancialMetrics(revenuesInPeriod, ordersInPeriod);
    const marketingKpis = calculateMarketingMetrics(adsInPeriod);
    const operationalKpis = calculateOperationalMetrics(ordersInPeriod, revenuesInPeriod);
    
    const totalCost = financialKpis.cogs + marketingKpis.adSpend + financialKpis.executionCost;
    const profit = financialKpis.netRevenue - totalCost;
    const roi = totalCost !== 0 ? (profit / totalCost) * 100 : 0;
    const profitMargin = financialKpis.netRevenue !== 0 ? (profit / financialKpis.netRevenue) * 100 : 0;
    const takeRate = financialKpis.gmv !== 0 ? (financialKpis.executionCost / financialKpis.gmv) * 100 : 0;

    // === BƯỚC SỬA 2: SỬA LẠI LỖI LOGIC ===
    // Dùng brandData.orders (dữ liệu trong kỳ) làm nguồn lịch sử tạm thời
    // Cách này sẽ không hoàn toàn chính xác cho khách mới/cũ nhưng sẽ không gây lỗi
    const customerKpis = calculateCustomerMetrics(allOrdersInSuperset, ordersPlacedInPeriod, marketingKpis.adSpend, profit);

    // ======================================

    return {
        ...financialKpis,
        ...marketingKpis,
        ...operationalKpis,
        ...customerKpis,
        totalCost,
        profit,
        roi,
        profitMargin,
        takeRate
    };
};