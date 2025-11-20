// FILE: frontend/src/hooks/useCountUp.js

import { useState, useEffect } from 'react';

/**
 * Custom hook để tạo hiệu ứng số đếm (count up).
 * @param {number} endValue - Giá trị cuối cùng mà số sẽ đếm tới.
 * @param {number} duration - Thời gian hoàn thành hiệu ứng (tính bằng mili-giây).
 * @returns {number} - Giá trị hiện tại của số trong quá trình đếm.
 */
export const useCountUp = (endValue, duration = 1000) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        // Chỉ thực hiện animation nếu endValue là một số hợp lệ
        if (typeof endValue !== 'number' || !isFinite(endValue)) {
            setCount(endValue); // Nếu không phải số, hiển thị giá trị gốc ngay lập tức
            return;
        }

        let startTime = null;
        let animationFrameId = null;
        const animationFrame = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            
            // Tính toán giá trị hiện tại dựa trên tiến trình
            const current = Math.min((progress / duration) * endValue, endValue);
            setCount(current);

            // Tiếp tục animation nếu chưa hoàn thành
            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animationFrame);
            } else {
                setCount(endValue); // Đảm bảo giá trị cuối cùng luôn chính xác
            }
        };

        // Bắt đầu animation
        animationFrameId = requestAnimationFrame(animationFrame);

        // Cleanup function để tránh memory leak nếu component unmount giữa chừng
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [endValue, duration]); // Hook sẽ chạy lại mỗi khi endValue thay đổi

    return count;
};