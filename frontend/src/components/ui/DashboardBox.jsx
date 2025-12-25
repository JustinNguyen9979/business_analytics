import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * DashboardBox - Hộp chứa nội dung chuẩn cho Dashboard.
 * Tái sử dụng Paper variant="glass" từ theme.
 * 
 * @param {string} title - Tiêu đề của hộp.
 * @param {string} minWidth - Chiều rộng tối thiểu (mặc định 500px).
 * @param {number|string} height - Chiều cao (mặc định 400).
 * @param {ReactNode} children - Nội dung bên trong.
 */
const DashboardBox = ({ title, action, children, minWidth = '500px', height = 400, sx = {} }) => {
    const theme = useTheme();
    return (
        <Paper 
            variant="glass" 
            sx={{ 
                position: 'relative', // Quan trọng cho SettingsPanel
                overflow: 'hidden',   // Quan trọng để Panel trượt mượt mà trong box
                flex: `1 1 ${minWidth}`, 
                p: 3, 
                height: height, 
                display: 'flex', 
                flexDirection: 'column',
                transition: 'all 0.3s ease',
                '&:hover': {
                    borderColor: theme.palette.primary.main,
                    boxShadow: `0 0 20px ${theme.palette.primary.main}30`,
                },
                ...sx 
            }}
        >
            {(title || action) && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    {title && (
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            {title}
                        </Typography>
                    )}
                    {action && <Box display="flex" gap={1}>{action}</Box>}
                </Box>
            )}
            <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minWidth: 0 }}>
                {children}
            </Box>
        </Paper>
    );
};

export default DashboardBox;