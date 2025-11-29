import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { fetchAsyncData } from '../services/api';

/**
 * Custom Hook để lấy dữ liệu tài chính cho kỳ hiện tại và kỳ trước đó.
 * @param {string} brandSlug - Slug của thương hiệu.
 * @param {Array<dayjs>} dateRange - Mảng chứa [ngày bắt đầu, ngày kết thúc] của kỳ hiện tại.
 */
export const useFinanceData = (brandSlug, dateRange) => {
    const [currentData, setCurrentData] = useState(null);
    const [previousData, setPreviousData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!brandSlug || !dateRange || !dateRange[0] || !dateRange[1]) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Tính toán kỳ trước
                const [start, end] = dateRange;
                const duration = end.diff(start, 'day'); // 0-based diff
                const prevEnd = start.subtract(1, 'day');
                const prevStart = prevEnd.subtract(duration, 'day');
                const previousDateRange = [prevStart, prevEnd];

                // 2. Gọi API song song cho cả hai kỳ
                const [currentResult, previousResult] = await Promise.all([
                    fetchAsyncData('kpis_by_platform', brandSlug, dateRange),
                    fetchAsyncData('kpis_by_platform', brandSlug, previousDateRange)
                ]);

                setCurrentData(currentResult);
                setPreviousData(previousResult);

            } catch (err) {
                setError(err.message || 'Lỗi không xác định khi tải dữ liệu tài chính.');
                setCurrentData(null);
                setPreviousData(null);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
    }, [brandSlug, dateRange]);

    // Đổi tên `data` thành `currentData` để rõ ràng hơn
    return { currentData, previousData, loading, error };
};
