// FILE: frontend/src/hooks/useKpiData.js (TẠO MỚI)

import { useState, useEffect } from 'react';
import { getBrandDetails } from '../services/api';
import dayjs from 'dayjs';

/**
 * Tính toán khoảng thời gian so sánh.
 * @param {dayjs} startDate - Ngày bắt đầu của kỳ hiện tại.
 * @param {dayjs} endDate - Ngày kết thúc của kỳ hiện tại.
 * @returns {Array<dayjs>} - Mảng [ngày bắt đầu kỳ trước, ngày kết thúc kỳ trước].
 */
const getPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return [null, null];
    const durationInDays = endDate.diff(startDate, 'day');
    const prevEndDate = startDate.clone().subtract(1, 'day');
    const prevStartDate = prevEndDate.clone().subtract(durationInDays, 'day');
    return [prevStartDate.startOf('day'), prevEndDate.endOf('day')];
};

/**
 * Custom Hook để quản lý việc lấy dữ liệu cho bảng KPI.
 * @param {string} brandId - ID của thương hiệu.
 * @param {Array<dayjs>} dateRange - Khoảng thời gian cho KPI.
 * @returns {object} - Trạng thái và dữ liệu của KPI.
 */
export const useKpiData = (brandId, dateRange) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [brandInfo, setBrandInfo] = useState({ name: '' });
    const [kpiData, setKpiData] = useState({ current: null, previous: null });

    useEffect(() => {
        const fetchData = async () => {
            if (!brandId || !dateRange) return;

            setLoading(true);
            setError(null);

            const [kpiStart, kpiEnd] = dateRange;
            const [prevKpiStart, prevKpiEnd] = getPreviousPeriod(kpiStart, kpiEnd);

            try {
                // Chỉ gọi các API liên quan đến KPI
                const [kpiResponse, prevKpiResponse] = await Promise.all([
                    getBrandDetails(brandId, kpiStart, kpiEnd),
                    getBrandDetails(brandId, prevKpiStart, prevKpiEnd)
                ]);

                if (kpiResponse) setBrandInfo({ id: kpiResponse.id, name: kpiResponse.name });
                
                setKpiData({
                    current: kpiResponse ? kpiResponse.kpis : null,
                    previous: prevKpiResponse ? prevKpiResponse.kpis : null
                });

            } catch (err) {
                setError("Không thể tải dữ liệu KPI.");
                console.error("Lỗi khi fetch KPI data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [brandId, dateRange]); // Hook chỉ chạy lại khi brandId hoặc dateRange của KPI thay đổi

    return { loading, error, brandInfo, kpiData };
};