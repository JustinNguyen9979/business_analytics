import dayjs from "dayjs";

export const dateShortcuts = [
        { label: 'Hôm nay', getValue: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
        { label: 'Hôm qua', getValue: () => [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
        { label: '7 ngày qua', getValue: () => [dayjs().subtract(6, 'days').startOf('day'), dayjs().endOf('day')] },
        { label: '28 ngày qua', getValue: () => [dayjs().subtract(27, 'days').startOf('day'), dayjs().endOf('day')] },
        { label: 'Tuần hiện tại', getValue: () => [dayjs().startOf('week'), dayjs().endOf('week')] },
        { label: 'Tháng hiện tại', getValue: () => [dayjs().startOf('month'), dayjs().endOf('day')] },
        { label: 'Tháng trước', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
        { label: 'Năm nay', getValue: () => [dayjs().startOf('year'), dayjs().endOf('day')] },
    ];

export const kpiGroups = [
        {
            groupTitle: 'Tài chính',
            items: [
                { key: 'netRevenue', title: 'DOANH THU RÒNG', format: 'currency' },
                { key: 'gmv', title: 'GMV', format: 'currency', tooltipText: 'Gross Merchandise Value - Tổng giá trị hàng hóa đã bán (chưa trừ chi phí).' },
                { key: 'totalCost', title: 'TỔNG CHI PHÍ', format: 'currency', tooltipText: 'Tổng chi phí bao gồm Giá vốn và Chi phí Thực thi.', direction: 'down' },
                { key: 'cogs', title: 'GIÁ VỐN (COGS)', format: 'currency', tooltipText: 'Cost of Goods Sold - Chi phí giá vốn hàng bán.' },
                { key: 'executionCost', title: 'CHI PHÍ THỰC THI', format: 'currency', direction: 'down' },
                { key: 'profit', title: 'LỢI NHUẬN GỘP', format: 'currency' },
                { key: 'roi', title: 'ROI (%)', format: 'percent', tooltipText: 'Return on Investment - Tỷ suất lợi nhuận trên tổng chi phí. Công thức: (Lợi nhuận / Tổng chi phí) * 100.' },
                { key: 'profitMargin', title: 'TỶ SUẤT LỢI NHUẬN (%)', format: 'percent', tooltipText: 'Tỷ lệ lợi nhuận so với doanh thu. Công thức: (Lợi nhuận / Doanh thu Ròng) * 100.' },
                { key: 'takeRate', title: 'TAKE RATE (%)', format: 'percent', tooltipText: 'Tỷ lệ phần trăm chi phí thực thi so với GMV. Công thức: (Chi phí Thực thi / GMV) * 100.', direction: 'down' },
            ]
        },
        {
            groupTitle: 'Marketing',
            items: [
                { key: 'adSpend', title: 'CHI PHÍ ADS', format: 'currency' },
                { key: 'roas', title: 'ROAS', format: 'number', tooltipText: 'Return on Ad Spend - Doanh thu trên chi phí quảng cáo. Công thức: Doanh thu từ Ads / Chi phí Ads.' },
                { key: 'cpo', title: 'CPO', format: 'currency', tooltipText: 'Cost Per Order - Chi phí để có được một đơn hàng từ quảng cáo.' },
                { key: 'ctr', title: 'CTR (%)', format: 'percent', tooltipText: 'Click-Through Rate - Tỷ lệ nhấp chuột vào quảng cáo.' },
                { key: 'cpc', title: 'CPC', format: 'currency', tooltipText: 'Cost Per Click - Chi phí cho mỗi lượt nhấp chuột vào quảng cáo.' },
                { key: 'conversionRate', title: 'TỶ LỆ CHUYỂN ĐỔI (%)', format: 'percent' },
            ]
        },
        {
            groupTitle: 'Vận hành',
            items: [
                { key: 'totalOrders', title: 'TỔNG ĐƠN', format: 'number' },
                { key: 'completedOrders', title: 'ĐƠN CHỐT', format: 'number' },
                { key: 'cancelledOrders', title: 'ĐƠN HỦY', format: 'number', direction: 'down' },
                { key: 'refundedOrders', title: 'ĐƠN HOÀN', format: 'number', direction: 'down' },
                { key: 'aov', title: 'AOV', format: 'currency', tooltipText: 'Average Order Value - Giá trị trung bình của một đơn hàng.' },
                { key: 'upt', title: 'UPT', format: 'number', tooltipText: 'Units Per Transaction - Số sản phẩm trung bình trên một đơn hàng.' },
                { key: 'uniqueSkusSold', title: 'SỐ SKU ĐÃ BÁN', format: 'number', tooltipText: 'Số loại sản phẩm khác nhau đã được bán.' },
                { key: 'completionRate', title: 'Tỷ lệ Chốt', format: 'percent', tooltipText: 'Tỷ lệ giữa số đơn chốt và tổng số đơn.' },
                { key: 'refundRate', title: 'TỶ LỆ HOÀN', format: 'percent', direction: 'down' },
                { key: 'cancellationRate', title: 'TỶ LỆ HỦY', format: 'percent', direction: 'down' },
            ]
        },
        {
            groupTitle: 'Khách hàng',
            items: [
                { key: 'totalCustomers', title: 'TỔNG KHÁCH', format: 'number' },
                { key: 'newCustomers', title: 'KHÁCH MỚI', format: 'number' },
                { key: 'returningCustomers', title: 'KHÁCH QUAY LẠI', format: 'number' },
                { key: 'cac', title: 'CAC', format: 'currency', tooltipText: 'Customer Acquisition Cost - Chi phí để có được một khách hàng mới.' },
                { key: 'retentionRate', title: 'TỶ LỆ QL (%)', format: 'percent' },
                { key: 'ltv', title: 'LTV', format: 'currency', tooltipText: 'Customer Lifetime Value - Lợi nhuận trung bình một khách hàng mang lại.' },
            ]
        }
    ];