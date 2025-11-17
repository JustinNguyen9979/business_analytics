import { useState, useEffect } from 'react';
import { fetchAsyncData } from '../services/api';


/**
 * Custom Hook để lấy dữ liệu tài chính theo từng platform.
 * @param {string} brandId - ID của thương hiệu.
 * @param {Array<dayjs>} dateRange - Mảng chứa [ngày bắt đầu, ngày kết thúc].
 */
export const useFinanceData = (brandId, dateRange) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Không chạy nếu thiếu thông tin
        if (!brandId || !dateRange || !dateRange[0] || !dateRange[1]) {
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const result = await fetchAsyncData('kpis_by_platform', brandId, dateRange);
                setData(result);
            } catch (err) {
                setError(err.message || 'Lỗi không xác định khi tải dữ liệu tài chính.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        
    }, [brandId, dateRange]); // Chạy lại mỗi khi brandId hoặc dateRange thay đổi

    return { data, loading, error };
};
