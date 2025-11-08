/**
 * Hàm Easing Function (gia tốc/giảm tốc) để animation mượt mà hơn.
 * Bắt đầu chậm, tăng tốc ở giữa, và kết thúc chậm.
 */
export const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Hàm animation cốt lõi, sử dụng requestAnimationFrame.
 * @param {object} options - Đối tượng cấu hình cho animation.
 * @param {function(number)} options.onFrame - Callback được gọi trên mỗi frame, nhận vào tiến trình đã được làm mượt (0 đến 1).
 * @param {function} options.onDone - Callback được gọi khi animation hoàn tất.
 * @param {number} options.duration - Thời gian chạy animation (ms).
 * @returns {function} - Một hàm để hủy animation (cleanup function).
 */
export const startAnimation = ({ onFrame, onDone, duration }) => {
    // Kiểm tra an toàn để đảm bảo onFrame và onDone là function, tránh crash
    if (typeof onFrame !== 'function' || typeof onDone !== 'function') {
        console.error('startAnimation requires onFrame and onDone to be functions.');
        return () => {}; // Trả về hàm cleanup rỗng
    }

    let startTime = null;
    let animationFrameId;

    const animate = (timestamp) => {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const rawProgress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOutCubic(rawProgress);

        onFrame(easedProgress);

        if (rawProgress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            onDone();
        }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
};