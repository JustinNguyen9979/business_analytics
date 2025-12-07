// FILE: frontend/src/components/common/ChartPlaceholder.jsx

import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

/**
 * Component hiển thị một khung giữ chỗ (placeholder) cho biểu đồ.
 * @param {object} props - Props của component.
 * @param {string} props.title - Tiêu đề chính của placeholder.
 * @param {string} [props.message] - Một thông điệp phụ, mặc định là "(Không có dữ liệu)".
 */
function ChartPlaceholder({ title, message = "(Không có dữ liệu)" }) {
    return (
        // Sử dụng variant="placeholder" đã được định nghĩa sẵn trong theme
        // và các style bổ sung để đảm bảo chiều cao và căn chỉnh
        <Paper 
            variant="placeholder" 
            sx={{ 
                height: '450px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center' 
            }}
        >
            {/* <Box>
                <Typography variant="h6" color="text.secondary">
                    {title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {message}
                </Typography>
            </Box> */}
        </Paper>
    );
}

export default ChartPlaceholder;