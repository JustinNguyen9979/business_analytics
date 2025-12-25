import React from 'react';
import { Typography } from '@mui/material';

/**
 * SectionTitle - Tiêu đề cho các phần (Section) trong trang báo cáo.
 * Sử dụng style "sectionTitle" đã định nghĩa trong Theme.
 */
const SectionTitle = ({ children, sx = {} }) => (
    <Typography 
        variant="sectionTitle" 
        sx={{ ...sx }}
    >
        {children}
    </Typography>
);

export default SectionTitle;