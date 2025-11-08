// FILE: frontend/src/hooks/useCustomerDistribution.js (nội dung file được cập nhật)

import { useState, useEffect } from 'react';
import { getCustomerMapDistribution } from '../services/api';

export function useCustomerDistribution(brandId, dateRange) {
    const [mapData, setMapData] = useState([]);
    const [isMapLoading, setIsMapLoading] = useState(true);

    useEffect(() => {
        if (!brandId || !dateRange?.range) return;

        const [start, end] = dateRange.range;
        
        const fetchData = async () => {
            try {
                setMapData([]); // Xóa dữ liệu cũ
                setIsMapLoading(true);

                // <<< SỬA LẠI HÀM GỌI API >>>
                const distributionData = await getCustomerMapDistribution(brandId, start, end);
                
                setMapData(distributionData); // Lưu mảng dữ liệu đã tổng hợp vào state
            } catch (err) {
                console.error("Lỗi khi lấy dữ liệu phân bổ bản đồ:", err);
                setMapData([]);
            } finally {
                setIsMapLoading(false);
            }
        };

        fetchData();

    }, [brandId, dateRange]);

    return { mapData, isMapLoading };
}