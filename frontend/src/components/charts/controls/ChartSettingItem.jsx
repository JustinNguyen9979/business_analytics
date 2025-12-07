import React from 'react';
import { Box, Typography, Checkbox, Switch } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { itemStyles, panelStyles } from './styles';

/**
 * ChartSettingItem - Một dòng tùy chọn đơn lẻ (Checkbox hoặc Switch).
 * 
 * @param {string} label - Tên tùy chọn
 * @param {boolean} checked - Trạng thái
 * @param {function} onChange - Hàm xử lý thay đổi
 * @param {string} color - Màu đại diện (chấm tròn màu trước tên) - Optional
 * @param {boolean} isSwitch - Dùng Switch thay vì Checkbox? (Mặc định false)
 */
const ChartSettingItem = ({ label, checked, onChange, color, isSwitch = false }) => {
    const theme = useTheme();

    return (
        <Box onClick={() => onChange(!checked)} sx={ itemStyles.container }>
            <Box sx={ itemStyles.labelWrapper }>
                {color && (
                    <Box sx={ itemStyles.colorDot(color, checked) } />
                )}
                <Typography variant="body2" sx={ itemStyles.labelText(theme, checked) }>
                    {label}
                </Typography>
            </Box>

            {isSwitch ? (
                <Switch 
                    checked={checked} 
                    onChange={(e) => onChange(e.target.checked)} 
                    size="small" 
                    sx={{ pointerEvents: 'none' }}
                />
            ) : (
                <Checkbox 
                    checked={checked} 
                    onChange={(e) => onChange(e.target.checked)} 
                    size="small"
                    sx={{ p: 0.5, pointerEvents: 'none' }}
                />
            )}
        </Box>
    );
};

export default ChartSettingItem;
