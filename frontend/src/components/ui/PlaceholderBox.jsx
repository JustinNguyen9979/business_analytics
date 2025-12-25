import React from 'react';
import { Paper, Typography, Box } from '@mui/material';

/**
 * PlaceholderBox - Hiển thị khi chưa có dữ liệu hoặc đang phát triển.
 * Tái sử dụng Paper variant="placeholder" từ theme.
 */
const PlaceholderBox = ({ label = "Dữ liệu sẽ được truyền vào đây", height = '100%' }) => (
    <Paper 
        variant="placeholder" 
        sx={{ height: height, width: '100%', flexDirection: 'column', gap: 1 }}
    >
        <Typography variant="body1" fontWeight={500} sx={{ opacity: 0.7 }}>{label}</Typography>
        <Typography variant="caption" sx={{ opacity: 0.5 }}>Dữ liệu sẽ được tự động cập nhật</Typography>
    </Paper>
);

export default PlaceholderBox;