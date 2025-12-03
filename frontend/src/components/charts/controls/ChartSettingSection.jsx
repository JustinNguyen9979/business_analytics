import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { panelStyles, sectionStyles } from './styles';

/**
 * ChartSettingSection - Một nhóm các tùy chọn trong panel cấu hình.
 * 
 * @param {string} title - Tiêu đề nhóm (VD: "Chỉ số", "Nguồn")
 * @param {React.ReactNode} children - Các item bên trong
 */
const ChartSettingSection = ({ title, children }) => {
    const theme = useTheme();
    return (
        <Box sx={ sectionStyles.container }>
            <Typography variant="caption" sx={ sectionStyles.title(theme) }>
                {title}
            </Typography>

            <Box sx={ sectionStyles.content }>
                {children}
            </Box>
            <Divider sx={ sectionStyles.divider } />
        </Box>
    );
};

export default ChartSettingSection;
