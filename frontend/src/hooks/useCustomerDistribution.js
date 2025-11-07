// FILE: frontend/src/hooks/useCustomerDistribution.js

import { useState, useEffect } from 'react';
// <<< SỬA LẠI IMPORT >>>
import { getCustomerHeatmap } from '../services/api';

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
                const coordinates = await getCustomerHeatmap(brandId, start, end);
                
                setMapData(coordinates); // Lưu mảng tọa độ vào state
            } catch (err) {
                console.error("Lỗi khi lấy dữ liệu heatmap:", err);
                setMapData([]);
            } finally {
                setIsMapLoading(false);
            }
        };

        fetchData();

    }, [brandId, dateRange]);

    return { mapData, isMapLoading };
}