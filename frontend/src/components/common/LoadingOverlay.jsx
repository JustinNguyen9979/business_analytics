import React from 'react';
import { Backdrop, CircularProgress, Typography, Box } from '@mui/material';
import { styled, keyframes } from '@mui/material/styles';
import { useTheme } from '@mui/material/styles';

/**
* Component overlay hiển thị trạng thái loading, thường dùng để phủ lên các biểu đồ hoặc nội dung.
* Sử dụng theme đã định nghĩa để có giao diện đồng bộ.
*
* @param {object} props
* @param {string} [props.message="Đang tải dữ liệu..."] - Thông điệp hiển thị dưới icon loading.
* @param {number} [props.borderRadius=2] - Border radius của overlay.
*/

function LoadingOverlay({ message = "Đang tải dữ liệu...", borderRadius = 2 }) {
    const theme = useTheme();

    return (
        <Box 
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: theme.palette.background.glassSecondary,
                zIndex: 2,
                borderRadius: borderRadius,
            }}
        >

            <CircularProgress color="primary" sx={{ mb: 2 }} />
            <Typography variant="body2" sx={{ color: theme.palette.primary.light }}>
                {message}
            </Typography>

        </Box>
    );
}

export default LoadingOverlay;