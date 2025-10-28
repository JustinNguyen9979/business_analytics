// FILE: frontend/src/utils/kpiCalculations.js

// Hàm định dạng số cho đẹp
export const formatCurrency = (value) => {
    if (value >= 1_000_000_000) {
        return `${(value / 1_000_000_000).toFixed(2)} tỷ`;
    }
    if (value >= 1_000_000) {
        return `${(value / 1_000_000).toFixed(0)} tr`;
    }
    if (value >= 1_000) {
        return `${(value / 1_000).toFixed(0)}k`;
    }
    return value.toLocaleString('vi-VN') + 'đ';
};

export const formatNumber = (value) => {
    return value.toLocaleString('vi-VN');
};

// Hàm tính toán tất cả các KPI
export const calculateAllKpis = (brandData) => {
    // Lấy dữ liệu thô từ API
    const revenues = brandData?.shopee_revenues || [];
    const ads = brandData?.shopee_ads || [];
    const orders = brandData?.orders || [];
    const products = brandData?.products || [];

    // --- TÍNH TOÁN ---

    // 1. Nhóm Tài chính
    const gmv = revenues.reduce((sum, item) => sum + (item.product_price || 0), 0);
    const totalCost = 0; // Tạm thời, sẽ tính sau khi có chi phí thực thi
    const executionCost = 0; // Tạm thời, cần dữ liệu chi phí thực thi
    const cogs = 0; // Tạm thời, giá vốn (Cost of Goods Sold)
    const profit = gmv - totalCost; // Tạm tính
    const roi = totalCost > 0 ? ((profit / totalCost) * 100).toFixed(2) + '%' : 'N/A';

    // 2. Nhóm Marketing
    const adSpend = ads.reduce((sum, item) => sum + (item.expense || 0), 0);
    const roas = adSpend > 0 ? (gmv / adSpend).toFixed(2) : '0.00';
    const totalOrdersFromAds = ads.reduce((sum, item) => sum + (item.conversions || 0), 0);
    const cpo = totalOrdersFromAds > 0 ? formatCurrency(adSpend / totalOrdersFromAds) : '0đ';
    const totalClicks = ads.reduce((sum, item) => sum + (item.clicks || 0), 0);
    const totalImpressions = ads.reduce((sum, item) => sum + (item.impressions || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) + '%' : '0.00%';
    const cpc = totalClicks > 0 ? formatCurrency(adSpend / totalClicks) : '0đ';
    const conversionRate = totalClicks > 0 ? ((totalOrdersFromAds / totalClicks) * 100).toFixed(2) + '%' : '0.00%';

    // 3. Nhóm Vận hành
    const totalOrders = new Set(orders.map(o => o.order_code)).size;
    const cancelledOrders = new Set(orders.filter(o => o.status === 'Đã hủy').map(o => o.order_code)).size;
    const completedOrders = totalOrders - cancelledOrders;
    const cancellationRate = totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(0) + '%' : '0%';
    const refundRate = '0%'; // Cần dữ liệu hoàn trả để tính
    const aov = completedOrders > 0 ? formatCurrency(gmv / completedOrders) : '0đ';
    
    // 4. Nhóm Khách hàng
    const allCustomers = new Set(orders.map(o => o.username));
    const totalCustomers = allCustomers.size;
    const newCustomers = totalCustomers; // Tạm tính, cần logic phức tạp hơn để phân biệt mới/cũ
    const returningCustomers = 0; // Tạm tính
    const cac = newCustomers > 0 ? formatCurrency(adSpend / newCustomers) : '0đ';


    // --- TRẢ VỀ OBJECT KẾT QUẢ ---
    return {
        gmv: formatCurrency(gmv),
        totalCost: formatCurrency(totalCost),
        cogs: formatCurrency(cogs),
        executionCost: formatCurrency(executionCost), 
        profit: formatCurrency(profit),
        roi,
        adSpend: formatCurrency(adSpend),
        roas,
        cpo,
        ctr,
        cpc,
        conversionRate,
        totalOrders: formatNumber(totalOrders),
        completedOrders: formatNumber(completedOrders),
        cancelledOrders: formatNumber(cancelledOrders),
        cancellationRate,
        refundRate,
        aov,
        totalCustomers: formatNumber(totalCustomers),
        newCustomers: formatNumber(newCustomers),
        returningCustomers: formatNumber(returningCustomers),
        cac,
    };
};