import React, { useState, useEffect, useRef } from 'react';
import { Box, Skeleton, Fade } from '@mui/material';

/**
 * LazyLoader Component
 * Chỉ render children khi component lọt vào khung nhìn (viewport).
 * @param {node} children - Nội dung cần lazy load.
 * @param {number|string} height - Chiều cao dự kiến của nội dung (để giữ chỗ, tránh giật layout).
 * @param {string} offset - Khoảng cách đệm để load trước khi cuộn tới (VD: '200px').
 */
const LazyLoader = ({ children, height = 400, offset = '200px', sx = {} }) => {
    const [isVisible, setIsVisible] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Khi element bắt đầu xuất hiện trong viewport (hoặc cách offset)
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    // Sau khi hiện rồi thì ngắt theo dõi luôn (chỉ load 1 lần)
                    if (containerRef.current) observer.unobserve(containerRef.current);
                    observer.disconnect();
                }
            },
            {
                rootMargin: offset, // Load trước khi cuộn tới 200px cho mượt
                threshold: 0
            }
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (observer) observer.disconnect();
        };
    }, [offset]);

    return (
        <Box ref={containerRef} sx={{ minHeight: isVisible ? 'auto' : height, width: '100%', mb: 3, ...sx }}>
            {isVisible ? (
                <Fade in={true} timeout={800}>
                    <Box sx={{ height: '100%' }}>{children}</Box>
                </Fade>
            ) : (
                <Skeleton 
                    variant="rectangular" 
                    height={height} 
                    sx={{ borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.05)' }} 
                />
            )}
        </Box>
    );
};

export default LazyLoader;
