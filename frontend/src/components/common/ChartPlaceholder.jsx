// FILE: frontend/src/components/common/ChartPlaceholder.jsx

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

/**
 * Component hiển thị một khung giữ chỗ (placeholder) cho biểu đồ.
 * @param {object} props - Props của component.
 * @param {string} props.title - Tiêu đề chính của placeholder.
 * @param {string} [props.message] - Một thông điệp phụ, mặc định là "(Không có dữ liệu)".
 */
function ChartPlaceholder({ title, message = "" }) {
    return (
        // Sử dụng variant="placeholder" đã được định nghĩa sẵn trong theme
        // và các style bổ sung để đảm bảo chiều cao và căn chỉnh
        <Paper 
            sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                textAlign: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                boxShadow: 'none',
            }}
        >
            <Box>
                <Typography variant="h6" color="text.secondary">
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {message}
                </Typography>
            </Box>
        </Paper>
    );
}

export default ChartPlaceholder;