import React from 'react';
import { Paper, Box, Typography, IconButton, Slide } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useTheme } from '@mui/material/styles';
import { panelStyles } from './styles';

/**
 * ChartSettingsPanel - Một panel trượt (Drawer) nằm bên trong khung biểu đồ.
 * Dùng để chứa các cấu hình, bộ lọc cho biểu đồ đó.
 *
 * @param {boolean} open - Trạng thái mở panel
 * @param {function} onClose - Hàm gọi khi đóng panel
 * @param {string} title - Tiêu đề panel
 * @param {React.ReactNode} children - Nội dung bên trong (các SettingSection)
 */
const ChartSettingsPanel = ({ open, onClose, title = "Tùy chọn", children }) => {
    const theme = useTheme();

    return (
        <>
            { open && (
                <Box
                    onClick={onClose}
                    sx={panelStyles.backdrop}
                />
            )}

            <Slide direction="left" in={open} mountOnEnter unmountOnExit>
                <Paper variant="glass" elevation={4} sx={ panelStyles.paper(theme) } >
                    {/* Header */}
                    <Box sx={ panelStyles.header(theme) }>
                        <Typography variant="h6" sx={ panelStyles.title }>
                            {title}
                        </Typography>
                        <IconButton size="small" onClick={onClose} sx={{ color: theme.palette.text.secondary }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    {/* Content Scrollable */}
                    <Box sx={ panelStyles.content(theme) }>
                        {children}
                    </Box>
                </Paper>
            </Slide>
        </>
    );
};
export default ChartSettingsPanel;
