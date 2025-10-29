// FILE: frontend/src/components/AuroraBackground.jsx

import React from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@mui/system';

// Định nghĩa các keyframes cho animation của các đốm màu
const animateBlob1 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(20vw, -15vh) scale(1.1); }
  50% { transform: translate(-10vw, 10vh) scale(0.9); }
  75% { transform: translate(15vw, 20vh) scale(1.2); }
`;

const animateBlob2 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(-15vw, 10vh) scale(1.2); }
  50% { transform: translate(10vw, -5vh) scale(0.8); }
  75% { transform: translate(-20vw, -15vh) scale(1.1); }
`;

const animateBlob3 = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  25% { transform: translate(10vw, 20vh) scale(0.9); }
  50% { transform: translate(-15vw, -10vh) scale(1.1); }
  75% { transform: translate(5vw, -20vh) scale(1); }
`;


function AuroraBackground() {
    const blobStyles = {
        position: 'absolute',
        filter: 'blur(100px)', // Độ mờ của các đốm màu, có thể tăng giảm
        mixBlendMode: 'color-dodge', // Chế độ hòa trộn màu
        opacity: 0.25,
    };

    return (
        <Box sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            zIndex: -1, // Nằm dưới tất cả
            backgroundColor: (theme) => theme.palette.background.default, // Màu nền tối phù hợp
        }}>
            {/* Đốm màu 1 */}
            <Box sx={{
                ...blobStyles,
                width: { xs: '300px', md: '500px' },
                height: { xs: '300px', md: '500px' },
                top: '-10%',
                left: '-10%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,191,255,1) 0%, rgba(0,0,0,0) 70%)',
                animation: `${animateBlob1} 25s infinite alternate`,
            }} />
            
            {/* Đốm màu 2 */}
            <Box sx={{
                ...blobStyles,
                width: { xs: '350px', md: '600px' },
                height: { xs: '350px', md: '600px' },
                bottom: '-15%',
                right: '-5%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(147,112,219,1) 0%, rgba(0,0,0,0) 70%)',
                animation: `${animateBlob2} 30s infinite alternate-reverse`,
            }} />

            {/* Đốm màu 3 */}
             <Box sx={{
                ...blobStyles,
                width: { xs: '250px', md: '400px' },
                height: { xs: '250px', md: '400px' },
                top: '20%',
                right: '25%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,100,200,1) 0%, rgba(0,0,0,0) 70%)',
                animation: `${animateBlob3} 20s infinite alternate`,
            }} />
        </Box>
    );
}

export default AuroraBackground;