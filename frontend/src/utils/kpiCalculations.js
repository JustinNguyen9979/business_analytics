// FILE: frontend/src/utils/kpiCalculations.js (PHIÊN BẢN SỬA LỖI TRẮNG MÀN HÌNH CUỐI CÙNG)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import minMax from 'dayjs/plugin/minMax';
dayjs.extend(isBetween);
dayjs.extend(minMax);

export const formatCurrency = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0 đ';
    return value.toLocaleString('vi-VN') + ' đ';
};
export const formatNumber = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0';
    return value.toLocaleString('vi-VN');
};

const calculateFinancialMetrics = (revenuesInPeriod, allOrdersInSuperset) => {
    const gmv = (revenuesInPeriod || []).reduce((sum, r) => sum + (r.gmv || 0), 0);
    const netRevenue = (revenuesInPeriod || []).reduce((sum, r) => sum + (r.net_revenue || 0), 0);
    const executionCost = (revenuesInPeriod || []).reduce((sum, r) => {
        const details = r.details || {};
        return sum + (
            parseFloat(details['Số tiền hoàn lại'] || 0) + parseFloat(details['Phí vận chuyển Người mua trả'] || 0) +
            parseFloat(details['Phí vận chuyển thực tế'] || 0) + parseFloat(details['Phí vận chuyển được trợ giá từ Shopee'] || 0) +
            parseFloat(details['Mã ưu đãi do Người Bán chịu'] || 0) + parseFloat(details['Phí cố định'] || 0) +
            parseFloat(details['Phí Dịch Vụ'] || 0) + parseFloat(details['Phí thanh toán'] || 0) +
            parseFloat(details['Phí trả hàng cho người bán'] || 0) + parseFloat(details['Phí trả hàng'] || 0) +
            parseFloat(details['Phí vận chuyển được hoàn bởi PiShip'] || 0) + parseFloat(details['Phí dịch vụ PiShip'] || 0) +
            parseFloat(details['Phí hoa hồng Tiếp thị liên kết'] || 0)
        );
    }, 0);

    const orderCodesFromRevenues = new Set((revenuesInPeriod || []).map(r => r.order_code));
    const financialOrders = (allOrdersInSuperset || []).filter(o => orderCodesFromRevenues.has(o.order_code));
    const cogs = financialOrders.reduce((sum, order) => sum + (order.cogs || 0), 0);
    
    return { gmv, netRevenue, executionCost: Math.abs(executionCost), cogs };
};

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

const calculateOperationalMetrics = (ordersPlacedInPeriod, revenuesInPeriod) => {
    const totalOrders = new Set((ordersPlacedInPeriod || []).map(o => o.order_code)).size;
    const cancelledOrders = new Set((ordersPlacedInPeriod || []).filter(o => o.status === 'Đã hủy').map(o => o.order_code)).size;
    
    const orderCodesInPeriod = new Set((ordersPlacedInPeriod || []).map(o => o.order_code));
    const relevantRevenues = (revenuesInPeriod || []).filter(r => orderCodesInPeriod.has(r.order_code));
    const refundedOrdersSet = new Set();
    relevantRevenues.forEach(r => {
        const refundCode = r.details?.['Mã yêu cầu hoàn tiền'];
        if (refundCode && String(refundCode).toLowerCase() !== 'nan') {
            const originalOrder = (ordersPlacedInPeriod || []).find(o => o.order_code === r.order_code);
            if (originalOrder && originalOrder.status !== 'Đã hủy') {
                refundedOrdersSet.add(r.order_code);
            }
        }
    });
    const refundedOrders = refundedOrdersSet.size;
    const completedOrders = totalOrders > 0 ? Math.max(0, totalOrders - cancelledOrders - refundedOrders) : 0;
    
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const refundRate = (totalOrders - cancelledOrders) > 0 ? (refundedOrders / (totalOrders - cancelledOrders)) * 100 : 0;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    const completedOrderCodesSet = new Set(
        (ordersPlacedInPeriod || [])
            .filter(o => o.status !== 'Đã hủy' && !refundedOrdersSet.has(o.order_code))
            .map(o => o.order_code)
    );
    const completedOperationalOrders = (ordersPlacedInPeriod || []).filter(o => completedOrderCodesSet.has(o.order_code));

    let allSoldSkus = [];
    completedOperationalOrders.forEach(order => { (order.details?.items || []).forEach(item => { if (item.sku) allSoldSkus.push(item.sku); }); });
    const uniqueSkusSold = new Set(allSoldSkus).size;

    const totalUnitsSold = completedOperationalOrders.reduce((sum, order) => sum + (order.total_quantity || 0), 0);
    const upt = completedOrders > 0 ? totalUnitsSold / completedOrders : 0;
    
    const relevantCompletedRevenues = (revenuesInPeriod || []).filter(r => completedOrderCodesSet.has(r.order_code));
    const gmvOfCompletedOrders = relevantCompletedRevenues.reduce((sum, r) => sum + (r.gmv || 0), 0);
    const aov = completedOrders > 0 ? gmvOfCompletedOrders / completedOrders : 0;

    return { totalOrders, cancelledOrders, completedOrders, uniqueSkusSold, cancellationRate, completionRate, upt, refundedOrders, refundRate, aov };
};

const calculateCustomerMetrics = (allOrdersHistory, ordersPlacedInPeriod, adSpend, profit) => {
    if (!ordersPlacedInPeriod || ordersPlacedInPeriod.length === 0) {
        return { totalCustomers: 0, newCustomers: 0, returningCustomers: 0, retentionRate: 0, cac: 0, ltv: 0 };
    }
    const customerFirstOrderDate = new Map();
    [...allOrdersHistory].sort((a, b) => dayjs(a.order_date).diff(dayjs(b.order_date))).forEach(order => {
        if (order.username && !customerFirstOrderDate.has(order.username)) {
            customerFirstOrderDate.set(order.username, dayjs(order.order_date));
        }
    });

    const customersInPeriod = new Set(ordersPlacedInPeriod.map(o => o.username).filter(Boolean));
    const datesInPeriod = ordersPlacedInPeriod.map(o => dayjs(o.order_date));
    const firstDateInPeriod = dayjs.min(datesInPeriod);
    const lastDateInPeriod = dayjs.max(datesInPeriod);

    let newCustomers = 0; let returningCustomers = 0;
    customersInPeriod.forEach(username => {
        const firstDate = customerFirstOrderDate.get(username);
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
// HÀM TỔNG HỢP: ĐÃ ĐƯỢC VIẾT LẠI HOÀN CHỈNH ĐỂ SỬA LỖI
// =========================================================================
export const calculateAllKpis = (brandData, dateRange) => {
    if (!brandData || !dateRange[0] || !dateRange[1]) {
        return {};
    }

    const [startDate, endDate] = dateRange.map(d => dayjs(d));
    
    // --- BƯỚC 1: LẤY DỮ LIỆU GỐC ---
    // Đây là "siêu tập hợp" từ backend, chứa tất cả đơn hàng có liên quan
    const allOrdersInSuperset = brandData.orders || []; 
    // Doanh thu và quảng cáo đã được lọc sẵn theo kỳ từ backend
    const revenuesInPeriod = brandData.revenues || [];
    const adsInPeriod = brandData.ads || [];
    
    // --- BƯỚC 2: TẠO CÁC TẬP DỮ LIỆU CON CẦN THIẾT ---
    // Lọc ra các đơn hàng được ĐẶT trong kỳ (dành cho chỉ số Vận hành & Khách hàng)
    const ordersPlacedInPeriod = allOrdersInSuperset.filter(o => 
        dayjs(o.order_date).isBetween(startDate, endDate, 'day', '[]')
    );
    
    // --- BƯỚC 3: GỌI CÁC HÀM TÍNH TOÁN VỚI DỮ LIỆU ĐÚNG ---
    const financialKpis = calculateFinancialMetrics(revenuesInPeriod, allOrdersInSuperset);
    const marketingKpis = calculateMarketingMetrics(adsInPeriod);
    const operationalKpis = calculateOperationalMetrics(ordersPlacedInPeriod, revenuesInPeriod);
    
    // --- BƯỚC 4: TÍNH TOÁN CÁC CHỈ SỐ PHỤ THUỘC ---
    const totalCost = financialKpis.cogs + marketingKpis.adSpend + financialKpis.executionCost;
    const profit = financialKpis.netRevenue - financialKpis.cogs;
    const roi = totalCost !== 0 ? (profit / totalCost) * 100 : 0;
    const profitMargin = financialKpis.netRevenue !== 0 ? (profit / financialKpis.netRevenue) * 100 : 0;
    const takeRate = financialKpis.gmv !== 0 ? (financialKpis.executionCost / financialKpis.gmv) * 100 : 0;
    
    // --- BƯỚC 5: TÍNH TOÁN CHỈ SỐ KHÁCH HÀNG ---
    // Dùng allOrdersInSuperset làm nguồn lịch sử để xác định khách hàng mới/cũ
    const customerKpis = calculateCustomerMetrics(allOrdersInSuperset, ordersPlacedInPeriod, marketingKpis.adSpend, profit);
    
    // --- BƯỚC 6: TRẢ VỀ KẾT QUẢ TỔNG HỢP ---
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