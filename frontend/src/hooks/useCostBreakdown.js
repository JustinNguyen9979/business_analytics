import { useMemo } from 'react';
import { useTheme } from '@mui/material/styles';

/**
 * Hook xử lý dữ liệu cho biểu đồ phân bổ chi phí (Donut Chart).
 * Chuyển đổi dữ liệu thô từ API (total_cost, cogs...) thành mảng dữ liệu cho biểu đồ.
 */
export const useCostBreakdown = (costData) => {
    const theme = useTheme();

    const chartData = useMemo(() => {
        if (!costData) return [];

        const { total_cost = 0, cogs = 0, execution_cost = 0, ad_spend = 0 } = costData;
        const numTotal = Number(total_cost) || 0;
        const numCogs = Number(cogs) || 0;
        const numExec = Number(execution_cost) || 0;
        const numAds = Number(ad_spend) || 0;
        
        // Tính phần "Khác"
        const otherCost = Math.max(0, numTotal - (numCogs + numExec + numAds));

        const data = [
            { name: 'Giá vốn (COGS)', value: numCogs, color: theme.palette.secondary.main },
            { name: 'Phí thực thi', value: numExec, color: '#17a2b8' }, // Cyan
            { name: 'Chi phí Ads', value: numAds, color: '#ffc107' },   // Amber
        ];

        if (otherCost > 1) { // Chỉ hiển thị nếu > 1đ để tránh số lẻ linh tinh
            data.push({ name: 'Khác', value: otherCost, color: theme.palette.grey[500] });
        }

        return data;
    }, [costData, theme]);

    return chartData;
};