// FILE: frontend/src/hooks/useCustomerDistribution.js

import { useState, useEffect, useCallback } from 'react';
import { requestCustomerDistribution, getCustomerDistribution } from '../services/api';

/**
 * Custom Hook để quản lý việc lấy dữ liệu phân bổ khách hàng một cách bất đồng bộ.
 * Nó sẽ tự động kích hoạt worker và "hỏi thăm" kết quả.
 * @param {string} brandId - ID của thương hiệu.
 * @param {object} dateRange - Object chứa { range, type } của bộ lọc thời gian.
 * @returns {{mapData: Array, isMapLoading: boolean}} - Dữ liệu bản đồ và trạng thái loading.
 */
export function useCustomerDistribution(brandId, dateRange) {
    const [mapData, setMapData] = useState([]);
    const [isMapLoading, setIsMapLoading] = useState(true);

    useEffect(() => {
        // Nếu không có brandId hoặc dateRange, không làm gì cả
        if (!brandId || !dateRange?.range) return;

        const [start, end] = dateRange.range;
        let isPolling = true; // Biến cờ để kiểm soát việc lặp lại trong closure

        const fetchData = async () => {
            try {
                // Bắt đầu chu trình, luôn đặt lại state
                setMapData([]);
                setIsMapLoading(true);

                // 1. Gửi yêu cầu "đặt hàng" cho worker tính toán
                await requestCustomerDistribution(brandId, start, end);
                
                // 2. Bắt đầu quá trình "hỏi thăm" (polling) kết quả từ cache
                const pollForResult = async () => {
                    // Dừng lại nếu component đã unmount hoặc bộ lọc đã thay đổi
                    if (!isPolling) return; 
                    
                    const data = await getCustomerDistribution(brandId, start, end);
                    
                    if (data && data.length > 0) {
                        // Nếu có kết quả, cập nhật state và dừng polling
                        setMapData(data);
                        setIsMapLoading(false);
                        isPolling = false;
                    } else {
                        // Nếu chưa có, chờ 2 giây rồi hỏi lại
                        setTimeout(pollForResult, 2000);
                    }
                };

                // Bắt đầu hỏi lần đầu tiên sau một khoảng trễ nhỏ để worker có thời gian khởi động
                setTimeout(pollForResult, 500);

            } catch (err) {
                console.error("Lỗi trong quá trình lấy dữ liệu bản đồ:", err);
                setMapData([]);
                setIsMapLoading(false);
                isPolling = false;
            }
        };

        fetchData();

        // Cleanup function: Rất quan trọng!
        // Nó sẽ được gọi khi component unmount hoặc khi dependency thay đổi (brandId, dateRange)
        // để ngăn chặn việc polling tiếp diễn vô ích.
        return () => {
            isPolling = false;
        };
    }, [brandId, dateRange]); // Hook sẽ tự động chạy lại khi brandId hoặc bộ lọc thời gian thay đổi

    // Trả về state cho component sử dụng
    return { mapData, isMapLoading };
}