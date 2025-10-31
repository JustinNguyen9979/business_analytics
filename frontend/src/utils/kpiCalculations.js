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

// =========================================================================
// HÀM 1: CHUYÊN TÍNH CÁC CHỈ SỐ TÀI CHÍNH
// =========================================================================
const calculateFinancialMetrics = (allRevenues, allOrders, allProducts, dateRange) => {
    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate || !allRevenues) {
        // Trả về cấu trúc đầy đủ với giá trị mặc định
        return { 
            gmv: 0, 
            netRevenue: 0, 
            executionCost: 0, 
            cogs: 0, 
            totalCost: 0, 
            profit: 0, 
            roi: 0, 
            profitMargin: 0, 
            takeRate: 0,
        };
    }

    const checkDate = (date) => {
        const d = dayjs(date);
        return !d.isBefore(startDate, 'day') && !d.isAfter(endDate, 'day');
    };

    // Lọc các bản ghi doanh thu theo `transaction_date`
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

    // =========================================================================
    // 2. TÍNH GIÁ VỐN (COGS) THEO LOGIC MỚI
    // =========================================================================
    // 2.1. Lấy danh sách `order_code` duy nhất từ các giao dịch doanh thu đã lọc
    const orderCodesInFinancialPeriod = new Set(filteredRevenues.map(r => r.order_code));

    // 2.2. Tìm tất cả các bản ghi `orders` tương ứng với các mã đơn hàng trên
    const relevantOrders = (allOrders || []).filter(o => orderCodesInFinancialPeriod.has(o.order_code));

    // 2.3. Tính tổng COGS từ các đơn hàng đã tìm được
    const cogs = relevantOrders.reduce((sum, order) => sum + (order.cogs || 0), 0);
    
    // 2.4 TÍNH TOÁN CÁC CHỈ SỐ PHỤ THUỘC
    const adSpend = 0; // Sẽ tính sau
    const totalCost = cogs + adSpend + Math.abs(executionCost);
    const profit = netRevenue - cogs;
    const roi = totalCost !== 0 ? (profit / totalCost) * 100 : 0;
    const profitMargin = netRevenue !== 0 ? (profit / netRevenue) * 100 : 0;
    const takeRate = gmv !== 0 ? (Math.abs(executionCost) / gmv) * 100 : 0;
    
    // 5. Trả về kết quả
    return { gmv, netRevenue, executionCost, cogs, totalCost, profit, roi, profitMargin, takeRate };
};

// =========================================================================
// HÀM 3: CHUYÊN TÍNH CÁC CHỈ SỐ VẬN HÀNH (THEO NGÀY ĐẶT HÀNG)
// =========================================================================
const calculateOperationalMetrics = (allOrders, allRevenues, dateRange) => {
    const [startDate, endDate] = dateRange;
    if (!startDate || !endDate) {
        return { 
            totalOrders: 0, 
            cancelledOrders: 0, 
            completedOrders: 0, 
            uniqueSkusSold: 0, 
            cancellationRate: 0, 
            completionRate: 0, 
            upt: 0, 
            refundedOrders: 0, 
            refundRate: 0,
            aov: 0 
        };
    }

    const checkDate = (date) => !dayjs(date).isBefore(startDate, 'day') && !dayjs(date).isAfter(endDate, 'day');
    const operationalOrders = (allOrders || []).filter(o => checkDate(o.order_date));

    // --- BẮT ĐẦU TÍNH TOÁN THEO ĐÚNG THỨ TỰ ---

    // 1. TÍNH CÁC CHỈ SỐ CƠ BẢN VỀ ĐƠN HÀNG
    const totalOrders = new Set(operationalOrders.map(o => o.order_code)).size;
    const cancelledOrders = new Set(operationalOrders.filter(o => o.status === 'Đã hủy').map(o => o.order_code)).size;
    
    const orderCodesInPeriod = new Set(operationalOrders.map(o => o.order_code));
    const relevantRevenues = (allRevenues || []).filter(r => orderCodesInPeriod.has(r.order_code));
    const refundedOrdersSet = new Set();
    relevantRevenues.forEach(r => {
        const refundCode = r.details?.['Mã yêu cầu hoàn tiền'];
        if (refundCode && String(refundCode).toLowerCase() !== 'nan') {
            const originalOrder = operationalOrders.find(o => o.order_code === r.order_code);
            if (originalOrder && originalOrder.status !== 'Đã hủy') {
                refundedOrdersSet.add(r.order_code);
            }
        }
    });
    const refundedOrders = refundedOrdersSet.size;

    const completedOrders = totalOrders - cancelledOrders - refundedOrders;
    
    // 2. TÍNH CÁC TỶ LỆ
    const cancellationRate = totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0;
    const refundRate = (totalOrders - cancelledOrders) > 0 ? (refundedOrders / (totalOrders - cancelledOrders)) * 100 : 0;
    const completionRate = totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0;

    // 3. TÍNH CÁC CHỈ SỐ DỰA TRÊN ĐƠN HÀNG ĐÃ CHỐT
    // Lọc ra các đơn hàng thực sự đã chốt
    const completedOrderCodesSet = new Set(
        operationalOrders
            .filter(o => o.status !== 'Đã hủy' && !refundedOrdersSet.has(o.order_code))
            .map(o => o.order_code)
    );
    const completedOperationalOrders = operationalOrders.filter(o => completedOrderCodesSet.has(o.order_code));

    // Tính SKU đã bán
    let allSoldSkus = [];
    completedOperationalOrders.forEach(order => {
        const items = order.details?.items || [];
        items.forEach(item => { if (item.sku) allSoldSkus.push(item.sku); });
    });
    const uniqueSkusSold = new Set(allSoldSkus).size;

    // Tính UPT
    const totalUnitsSold = completedOperationalOrders.reduce((sum, order) => sum + (order.total_quantity || 0), 0);
    const upt = completedOrders > 0 ? totalUnitsSold / completedOrders : 0;
    
    // TÍNH AOV
    const relevantCompletedRevenues = (allRevenues || []).filter(r => completedOrderCodesSet.has(r.order_code));
    const gmvOfCompletedOrders = relevantCompletedRevenues.reduce((sum, r) => sum + (r.gmv || 0), 0);
    const aov = completedOrders > 0 ? gmvOfCompletedOrders / completedOrders : 0;

    return { 
        totalOrders, 
        cancelledOrders, 
        completedOrders, 
        uniqueSkusSold, 
        cancellationRate, 
        completionRate, 
        upt, 
        refundedOrders, 
        refundRate,
        aov
    };
};

// =========================================================================
// HÀM 4: CHUYÊN TÍNH CÁC CHỈ SỐ KHÁCH HÀNG (THEO NGÀY ĐẶT HÀNG)
// =========================================================================
const calculateCustomerMetrics = (allOrders, dateRange, adSpend, profit) => {
    const [startDate, endDate] = dateRange;
    // Trả về cấu trúc mặc định nếu không có dữ liệu
    if (!startDate || !endDate || !allOrders || allOrders.length === 0) {
        return { totalCustomers: 0, newCustomers: 0, returningCustomers: 0, retentionRate: 0, cac: 0, ltv: 0 };
    }

    // --- BƯỚC 1: XÂY DỰNG LỊCH SỬ MUA HÀNG ---
    // Tạo một bản đồ để lưu ngày mua hàng đầu tiên của mỗi khách hàng
    const customerFirstOrderDate = new Map();
    // Sắp xếp toàn bộ lịch sử đơn hàng theo ngày để đảm bảo tìm đúng ngày đầu tiên
    const sortedAllOrders = [...allOrders].sort((a, b) => new Date(a.order_date) - new Date(b.order_date));
    
    for (const order of sortedAllOrders) {
        // Chỉ xử lý nếu có username và chưa tồn tại trong bản đồ
        if (order.username && !customerFirstOrderDate.has(order.username)) {
            customerFirstOrderDate.set(order.username, dayjs(order.order_date));
        }
    }

    // --- BƯỚC 2: LỌC ĐƠN HÀNG TRONG KỲ ĐANG XEM ---
    const checkDate = (date) => !dayjs(date).isBefore(startDate, 'day') && !dayjs(date).isAfter(endDate, 'day');
    const operationalOrders = allOrders.filter(o => checkDate(o.order_date));

    // --- BƯỚC 3: PHÂN LOẠI KHÁCH HÀNG ---
    let newCustomers = 0;
    let returningCustomers = 0;
    // Lấy danh sách khách hàng duy nhất đã mua trong kỳ này
    const customersInPeriod = new Set(operationalOrders.map(o => o.username).filter(Boolean));
    
    customersInPeriod.forEach(username => {
        const firstDate = customerFirstOrderDate.get(username);
        // Nếu ngày đầu tiên của khách hàng nằm trong khoảng đang xem -> khách mới
        // Dùng checkDate để đảm bảo logic nhất quán
        if (firstDate && checkDate(firstDate)) {
            newCustomers++;
        } else {
            // Ngược lại, họ là khách cũ quay lại (bao gồm cả trường hợp không tìm thấy firstDate,
            // nghĩa là ngày đầu tiên của họ nằm ngoài bộ dữ liệu hiện có)
            returningCustomers++;
        }
    });

    const totalCustomers = customersInPeriod.size;

    // --- BƯỚC 4: TÍNH TOÁN CÁC CHỈ SỐ LIÊN QUAN ---
    const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;
    const cac = newCustomers > 0 ? adSpend / newCustomers : 0;
    const ltv = totalCustomers > 0 ? profit / totalCustomers : 0;
    
    // --- BƯỚC 5: TRẢ VỀ KẾT QUẢ ---
    return {
        totalCustomers,
        newCustomers,
        returningCustomers,
        retentionRate,
        cac,
        ltv,
    };
};

// --- HÀM TÍNH TOÁN KPI TỔNG ---
export const calculateAllKpis = (brandData, dateRange) => {
    if (!brandData || !dateRange[0] || !dateRange[1]) {
        return {};
    }

    const { revenues, orders, products, ads } = brandData;
    
    // 1. Tính toán các chỉ số cơ sở
    const financialKpis = calculateFinancialMetrics(revenues, orders, products, dateRange);
    const operationalKpis = calculateOperationalMetrics(orders, revenues, dateRange);

    // 3. Gọi hàm customer với các tham số đã có
    const customerKpis = calculateCustomerMetrics(orders, dateRange, financialKpis.adSpend, financialKpis.profit);

    // 4. Gộp tất cả kết quả lại
    return {
        ...financialKpis,
        ...operationalKpis,
        ...customerKpis,
    };
};