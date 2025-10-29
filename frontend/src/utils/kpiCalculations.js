// FILE: frontend/src/utils/kpiCalculations.js (PHIÊN BẢN TRẢ VỀ ĐẦY ĐỦ 100% CHỈ SỐ)

import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
dayjs.extend(isBetween);

// --- HÀM HỖ TRỢ ĐỊNH DẠNG SỐ LIỆU ---
export const formatCurrency = (value) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
    return value.toLocaleString('vi-VN') + ' đ';
};
export const formatNumber = (value) => {
    return value.toLocaleString('vi-VN');
};

// --- HÀM TÍNH TOÁN TẤT CẢ CÁC CHỈ SỐ KPI ---
export const calculateAllKpis = (brandData, dateRange) => {
    const [startDate, endDate] = dateRange;

    if (!startDate || !endDate || !brandData) {
        return {};
    }

    const allRevenues = brandData.shopee_revenues || [];
    const allAds = brandData.shopee_ads || [];
    const allOrders = brandData.orders || [];
    const allProducts = brandData.products || [];

    const checkDate = (date) => dayjs(date).isSame(startDate, 'day') || dayjs(date).isSame(endDate, 'day') || dayjs(date).isBetween(startDate, endDate, 'day');

    const filteredRevenues = allRevenues.filter(r => checkDate(r.payment_completed_date));
    const filteredAds = allAds.filter(a => checkDate(a.start_date));
    const filteredOrders = allOrders.filter(o => checkDate(o.order_date));
    
    // --- BẮT ĐẦU TÍNH TOÁN TRÊN DỮ LIỆU ĐÃ LỌC ---
    
    // NHÓM TÀI CHÍNH
    const totalPayment = filteredRevenues.reduce((sum, item) => sum + (item.total_payment || 0), 0);
    const totalRefund = filteredRevenues.reduce((sum, item) => sum + (item.refund_amount || 0), 0);
    const netRevenue = totalPayment - totalRefund;
    const adSpend = filteredAds.reduce((sum, item) => sum + (item.expense || 0), 0);
    const productCostMap = new Map();
    allProducts.forEach(p => { productCostMap.set(p.sku, p.cost_price || 0); });
    const completedOrdersData = filteredOrders.filter(o => o.status !== 'Đã hủy');
    const cogs = completedOrdersData.reduce((sum, order) => sum + ((productCostMap.get(order.sku) || 0) * (order.quantity || 0)), 0);
    const totalShopeeFees = filteredRevenues.reduce((sum, item) => sum + (item.fixed_fee || 0) + (item.service_fee || 0) + (item.payment_fee || 0) + (item.commission_fee || 0) + (item.affiliate_marketing_fee || 0), 0);
    const netShippingCost = filteredRevenues.reduce((sum, item) => sum + ((item.actual_shipping_fee || 0) - (item.buyer_paid_shipping_fee || 0) - (item.shopee_subsidized_shipping_fee || 0)), 0);
    const executionCost = totalShopeeFees + netShippingCost;
    const totalCost = cogs + adSpend + executionCost;
    const profit = netRevenue - totalCost;
    const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    const profitMargin = netRevenue > 0 ? (profit / netRevenue) * 100 : 0;

    // NHÓM VẬN HÀNH
    const gmv = filteredRevenues.reduce((sum, item) => sum + (item.product_price || 0), 0);
    const totalOrders = new Set(filteredOrders.map(o => o.order_code)).size;
    const cancelledOrders = new Set(filteredOrders.filter(o => o.status === 'Đã hủy').map(o => o.order_code)).size;
    const completedOrders = totalOrders - cancelledOrders;
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const refundedOrderCount = new Set(filteredRevenues.filter(r => r.refund_amount > 0).map(r => r.order_code)).size;
    const refundRate = completedOrders > 0 ? (refundedOrderCount / completedOrders) * 100 : 0;
    const aov = completedOrders > 0 ? gmv / completedOrders : 0;
    const totalUnitsSold = completedOrdersData.reduce((sum, order) => sum + (order.quantity || 0), 0);
    const upt = completedOrders > 0 ? totalUnitsSold / completedOrders : 0;
    const uniqueSkusSold = new Set(completedOrdersData.map(o => o.sku)).size;

    // NHÓM MARKETING
    const roas = adSpend > 0 ? gmv / adSpend : 0;
    const totalOrdersFromAds = filteredAds.reduce((sum, item) => sum + (item.conversions || 0), 0);
    const cpo = totalOrdersFromAds > 0 ? adSpend / totalOrdersFromAds : 0;
    const totalClicks = filteredAds.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalImpressions = filteredAds.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cpc = totalClicks > 0 ? adSpend / totalClicks : 0;
    const conversionRate = totalClicks > 0 ? (totalOrdersFromAds / totalClicks) * 100 : 0;

    // NHÓM KHÁCH HÀNG
    const allCustomers = new Set(filteredOrders.map(o => o.username).filter(Boolean));
    const totalCustomers = allCustomers.size;
    const newCustomers = totalCustomers;
    const returningCustomers = 0;
    const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
    const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
    const ltv = totalCustomers > 0 ? profit / totalCustomers : 0;

    // =================================================================
    // SỬA LỖI Ở ĐÂY: ĐẢM BẢO TRẢ VỀ TẤT CẢ CÁC BIẾN ĐÃ TÍNH TOÁN
    // =================================================================
    return {
        // Tài chính
        gmv, totalCost, cogs, executionCost, profit, roi, profitMargin,
        // Marketing
        adSpend, roas, cpo, ctr, cpc, conversionRate,
        // Vận hành
        totalOrders, completedOrders, cancelledOrders, cancellationRate, refundRate, aov, upt, uniqueSkusSold,
        // Khách hàng
        totalCustomers, newCustomers, returningCustomers, cac, retentionRate, ltv,
    };
};