import { keyframes } from "@emotion/react";
import dayjs from "dayjs";
import { Form } from "react-router-dom";
import { formatCurrency } from "../utils/formatters";

export const dateShortcuts = [
        { label: 'Hôm nay', type: 'today', getValue: () => [dayjs().startOf('day'), dayjs().endOf('day')] },
        { label: 'Hôm qua', type: 'yesterday', getValue: () => [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')] },
        { label: '7 ngày qua', type: 'last_7_days', getValue: () => [dayjs().subtract(6, 'days').startOf('day'), dayjs().endOf('day')] },
        { label: '28 ngày qua', type: 'last_28_days', getValue: () => [dayjs().subtract(27, 'days').startOf('day'), dayjs().endOf('day')] },
        { label: 'Tuần này', type: 'this_week', getValue: () => [dayjs().startOf('week'), dayjs().endOf('week')] },
        { label: 'Tháng này', type: 'this_month', getValue: () => [dayjs().startOf('month'), dayjs().endOf('month')] },
        { label: 'Tháng trước', type: 'last_month', getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')] },
        { label: 'Năm nay', type: 'this_year', getValue: () => [dayjs().startOf('year'), dayjs().endOf('year')] },
    ];

export const kpiGroups = [
        {
            key: 'finance',
            groupTitle: 'Tài chính',
            items: [
                { key: 'gmv', title: 'GMV', format: 'currency', tooltipText: 'Gross Merchandise Value - Tổng giá trị hàng hóa đã bán (chưa trừ chi phí).' },
                { key: 'net_revenue', title: 'DOANH THU RÒNG', format: 'currency' },
                { key: 'total_cost', title: 'TỔNG CHI PHÍ', format: 'currency', tooltipText: 'Tổng chi phí bao gồm Giá vốn và Chi phí Thực thi.', direction: 'down' },
                { key: 'cogs', title: 'GIÁ VỐN (COGS)', format: 'currency', tooltipText: 'Cost of Goods Sold - Chi phí giá vốn hàng bán.' },
                { key: 'execution_cost', title: 'CHI PHÍ THỰC THI', format: 'currency', direction: 'down' },
                { key: 'profit', title: 'LỢI NHUẬN GỘP', format: 'currency' },
                { key: 'roi', title: 'ROI (%)', format: 'percent', tooltipText: 'Return on Investment - Tỷ suất lợi nhuận trên tổng chi phí. Công thức: (Lợi nhuận / Tổng chi phí) * 100.' },
                { key: 'profit_margin', title: 'TỶ SUẤT LỢI NHUẬN (%)', format: 'percent', tooltipText: 'Tỷ lệ lợi nhuận so với doanh thu. Công thức: (Lợi nhuận / Doanh thu Ròng) * 100.' },
                { key: 'take_rate', title: 'TAKE RATE (%)', format: 'percent', tooltipText: 'Tỷ lệ phần trăm chi phí thực thi so với GMV. Công thức: (Chi phí Thực thi / GMV) * 100.', direction: 'down' },
            ]
        },
        {
            key: 'marketing',
            groupTitle: 'Marketing',
            items: [
                { key: 'ad_spend', title: 'CHI PHÍ ADS', format: 'currency' },
                { key: 'conversions', title: 'CHUYỂN ĐỔI', format: 'number'},
                { key: 'cpm', title: 'CPM', format: 'currency', tooltipText: 'Cost Per Mille - Chi phí cho 1.000 lần hiển thị'},
                { key: 'cpa', title: 'CPA', format: 'currency', tooltipText: 'Cost Per Action - Chi phí mỗi lượt chuyển đổi.' },
                { key: 'ctr', title: 'CTR (%)', format: 'percent', tooltipText: 'Click-Through Rate - Tỷ lệ nhấp chuột vào quảng cáo.' },
                { key: 'cpc', title: 'CPC', format: 'currency', tooltipText: 'Cost Per Click - Chi phí cho mỗi lượt nhấp chuột vào quảng cáo.' },
                { key: 'roas', title: 'ROAS', format: 'number', tooltipText: 'Return on Ad Spend - Doanh thu trên chi phí quảng cáo. Công thức: Doanh thu từ Ads / Chi phí Ads.' },
                { key: 'impressions', title: 'LƯỢT HIỂN THỊ', format: 'number'},
                { key: 'clicks', title: 'CLICK', format: 'number'},
                { key: 'reach', title: 'LƯỢT TIẾP CẬN', format: 'number'},
                { key: 'frequency', title: 'TẦN SUẤT', format: 'number'},
                { key: 'conversion_rate', title: 'TỶ LỆ CHUYỂN ĐỔI (%)', format: 'percent' },
            ]
        },
        {
            key: 'operations',
            groupTitle: 'Vận hành',
            items: [
                { key: 'total_orders', title: 'TỔNG ĐƠN', format: 'number' },
                { key: 'completed_orders', title: 'ĐƠN CHỐT', format: 'number' },
                { key: 'cancelled_orders', title: 'ĐƠN HỦY', format: 'number', direction: 'down' },
                { key: 'refunded_orders', title: 'ĐƠN HOÀN TIỀN', format: 'number', direction: 'down' },
                { key: 'aov', title: 'AOV', format: 'currency', tooltipText: 'Average Order Value - Giá trị trung bình của một đơn hàng.' },
                { key: 'upt', title: 'UPT', format: 'number', tooltipText: 'Units Per Transaction - Số sản phẩm trung bình trên một đơn hàng.' },
                { key: 'unique_skus_sold', title: 'SỐ SKU ĐÃ BÁN', format: 'number', tooltipText: 'Số loại sản phẩm khác nhau đã được bán.' },
                { key: 'completion_rate', title: 'Tỷ lệ Chốt', format: 'percent', tooltipText: 'Tỷ lệ giữa số đơn chốt và tổng số đơn.' },
                { key: 'refund_rate', title: 'TỶ LỆ HOÀN', format: 'percent', direction: 'down' },
                { key: 'cancellation_rate', title: 'TỶ LỆ HỦY', format: 'percent', direction: 'down' },
            ]
        },
        {
            key: 'customers',
            groupTitle: 'Khách hàng',
            items: [
                { key: 'total_customers', title: 'TỔNG KHÁCH', format: 'number' },
                { key: 'new_customers', title: 'KHÁCH MỚI', format: 'number' },
                { key: 'returning_customers', title: 'KHÁCH QUAY LẠI', format: 'number' },
                { key: 'cac', title: 'CAC', format: 'currency', tooltipText: 'Customer Acquisition Cost - Chi phí để có được một khách hàng mới.' },
                { key: 'retention_rate', title: 'TỶ LỆ QL (%)', format: 'percent' },
                { key: 'ltv', title: 'LTV', format: 'currency', tooltipText: 'Customer Lifetime Value - Lợi nhuận trung bình một khách hàng mang lại.' },
            ]
        }
    ];