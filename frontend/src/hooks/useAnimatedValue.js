import { useState, useEffect } from 'react';
import { startAnimation } from '../utils/animationUtils'; // Sử dụng tiện ích animation đã được chuẩn hóa

/**
 * Custom hook để tạo hiệu ứng số đếm (count up) từ 0 đến giá trị cuối cùng.
 * Logic được sao chép và điều chỉnh chính xác từ file TopProductsChart.jsx.
 * @param {number} endValue - Giá trị cuối cùng mà số sẽ đếm tới.
 * @param {number} duration - Thời gian hoàn thành hiệu ứng (tính bằng mili-giây).
 * @returns {number} - Giá trị hiện tại của số trong quá trình chuyển động.
 */
export const useAnimatedValue = (endValue, duration = 1200) => {
    // Luôn khởi tạo giá trị hiển thị là 0, giống như thanh bar có chiều dài 0 lúc đầu.
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        // Chuẩn hóa giá trị cuối cùng (đích đến) để đảm bảo nó luôn là một con số.
        const finalEndValue = (typeof endValue === 'number' && isFinite(endValue)) ? endValue : 0;

        // Bắt đầu animation và lưu lại hàm cleanup.
        // Toàn bộ logic bên trong được lấy từ logic mẫu.
        const cleanup = startAnimation({
            duration: duration,
            
            // onFrame tương đương với hàm `animate` trong logic mẫu.
            // Nó được gọi trên mỗi frame.
            onFrame: (progress) => {
                // Áp dụng công thức cốt lõi: currentValue = finalValue * progress
                const currentValue = finalEndValue * progress;
                setDisplayValue(currentValue);
            },
            
            // onDone được gọi khi animation kết thúc (khi progress >= 1).
            onDone: () => {
                // Đảm bảo giá trị hiển thị cuối cùng luôn chính xác tuyệt đối.
                setDisplayValue(finalEndValue);
            }
        });

        // Trả về hàm cleanup để React tự động gọi khi component unmount
        // hoặc khi effect này chạy lại (do endValue thay đổi).
        return cleanup;

    }, [endValue, duration]); // Chạy lại animation mỗi khi giá trị đích thay đổi.

    return displayValue;
};