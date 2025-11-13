// FILE: frontend/src/hooks/useKpiData.js (PHIÊN BẢN BẤT ĐỒNG BỘ)

import { useState, useEffect } from 'react';
import { requestData, pollDataStatus } from '../services/api';
import dayjs from 'dayjs';

/**
 * Hook quản lý việc lấy dữ liệu bất đồng bộ với cơ chế polling.
 * @param {string} requestType - Loại dữ liệu cần lấy.
 * @param {string} brandId - ID của brand.
 * @param {Array<dayjs>} dateRange - Mảng chứa [startDate, endDate].
 */
export const useAsyncData = (requestType, brandId, dateRange) => {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Bỏ qua nếu chưa có đủ thông tin
        if (!requestType || !brandId || !dateRange || dateRange.length < 2) {
            return;
        }

        const [start, end] = dateRange;
        const params = {
            start_date: start.format('YYYY-MM-DD'),
            end_date: end.format('YYYY-MM-DD'),
        };

        let pollingInterval;

        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            setData(null); // Reset dữ liệu cũ

            try {
                // 1. Gửi yêu cầu ban đầu
                const initialResponse = await requestData(requestType, brandId, params);

                // 2. Xử lý phản hồi
                if (initialResponse.status === 'SUCCESS') {
                    // Cache Hit: Có dữ liệu ngay
                    setData(initialResponse.data);
                    setIsLoading(false);
                } else if (initialResponse.status === 'PROCESSING') {
                    // Cache Miss: Bắt đầu polling
                    const cacheKey = initialResponse.cache_key;
                    
                    pollingInterval = setInterval(async () => {
                        try {
                            const statusResponse = await pollDataStatus(cacheKey);
                            if (statusResponse.status === 'SUCCESS') {
                                clearInterval(pollingInterval);
                                setData(statusResponse.data);
                                setIsLoading(false);
                            } else if (statusResponse.status === 'FAILED') {
                                clearInterval(pollingInterval);
                                setError(statusResponse.error || 'Worker xử lý thất bại.');
                                setIsLoading(false);
                            }
                            // Nếu status vẫn là 'PROCESSING', không làm gì cả, chờ lần poll tiếp theo
                        } catch (pollError) {
                            clearInterval(pollingInterval);
                            setError('Lỗi khi kiểm tra trạng thái dữ liệu.');
                            setIsLoading(false);
                        }
                    }, 2000); // Hỏi thăm mỗi 2 giây
                }
            } catch (requestError) {
                setError('Không thể gửi yêu cầu lấy dữ liệu.');
                setIsLoading(false);
            }
        };

        fetchData();

        // Cleanup: Dọn dẹp interval khi component unmount hoặc tham số thay đổi
        return () => {
            if (pollingInterval) {
                clearInterval(pollingInterval);
            }
        };

    }, [requestType, brandId, dateRange]); // Chạy lại mỗi khi các tham số này thay đổi

    return { data, isLoading, error };
};