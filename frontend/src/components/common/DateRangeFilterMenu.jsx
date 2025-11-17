// FILE: frontend/src/components/common/DateRangeFilterMenu.jsx (PHIÊN BẢN SỬA LỖI TRÙNG HÀM)

import React, { useState, useEffect } from 'react';
import { 
    Menu, Box, List, ListItemButton, ListItemText, Button, Divider 
} from '@mui/material';
import { StaticDatePicker } from '@mui/x-date-pickers/StaticDatePicker';
import { dateShortcuts } from '../../config/dashboardConfig';
import dayjs from 'dayjs';

/**
 * Component Menu/Popover để chọn khoảng thời gian.
 * @param {object} props
 * @param {boolean} props.open - State boolean để điều khiển việc đóng/mở.
 * @param {HTMLElement} props.anchorEl - Phần tử HTML mà Menu sẽ neo vào.
 * @param {function} props.onClose - Hàm được gọi khi cần đóng Menu.
 * @param {Array<dayjs>} props.initialDateRange - Khoảng thời gian hiện tại.
 * @param {function(Array<dayjs>)} props.onApply - Hàm callback trả về khoảng thời gian mới.
 */

// Kỹ thuật để tái sử dụng cấu hình của StaticDatePicker, tránh lặp code
const datePickerSlotProps = { 
    actionBar: { actions: [] },
    // Thêm cấu hình cho header của lịch
    calendarHeader: {
        sx: {
            '& .MuiPickersArrowSwitcher-button': { color: (theme) => theme.palette.text.secondary },
            '& .MuiPickersCalendarHeader-label': { color: (theme) => theme.palette.text.primary },
            '& .MuiPickersCalendarHeader-switchViewIcon': { color: (theme) => theme.palette.text.secondary },
        }
    }
};

const [DatePicker1, DatePicker2] = [
    <StaticDatePicker displayStaticWrapperAs="desktop" slotProps={datePickerSlotProps} views={['year', 'month', 'day']} />,
    <StaticDatePicker displayStaticWrapperAs="desktop" slotProps={datePickerSlotProps} views={['year', 'month', 'day']} />
];

function DateRangeFilterMenu({ open, anchorEl, onClose, initialDateRange, onApply }) {
    const [tempDateRange, setTempDateRange] = useState(initialDateRange);

    // Effect để reset lại lựa chọn tạm thời mỗi khi Menu được mở
    useEffect(() => {
        if (open) {
            setTempDateRange(initialDateRange);
        }
    }, [open, initialDateRange]);

    const handleShortcutClick = (shortcut) => {
        // Bây giờ 'shortcut' là một object hoàn chỉnh { label, type, getValue }
        const newRange = shortcut.getValue();
        // Gửi cả range và type ra ngoài
        onApply(newRange, shortcut.type);
    };
    
    const handleApplyCustomDate = () => {
        onApply(tempDateRange, 'custom'); // Gửi giá trị đang chọn ra ngoài
    };

    return (
        <Menu
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ 
                sx: { 
                    mt: 1, 
                    borderRadius: 3, 
                    backdropFilter: 'blur(15px)', 
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                } 
            }}
        >
            <Box sx={{ display: 'flex' }}>
                {/* Cột trái: Lối tắt */}
                <Box sx={{ borderRight: 1, borderColor: 'divider', width: 180, flexShrink: 0 }}>
                    <List>
                        {dateShortcuts.map((shortcut) => (
                            <ListItemButton key={shortcut.label} onClick={() => handleShortcutClick(shortcut)}>
                                <ListItemText primary={shortcut.label} />
                            </ListItemButton>
                        ))}
                    </List>
                </Box>
                
                {/* Cột phải: Chứa lịch và nút bấm */}
                <Box>
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' } }}>
                        {/* Nhân bản và truyền props động vào các DatePicker đã cấu hình sẵn */}
                        {React.cloneElement(DatePicker1, {
                            value: tempDateRange[0],
                            maxDate: tempDateRange[1],
                            onChange: (newValue) => {
                                const newRange = [newValue, tempDateRange[1]];
                                if (newValue.isAfter(tempDateRange[1])) { newRange[1] = newValue; }
                                setTempDateRange(newRange);
                            }
                        })}
                        {React.cloneElement(DatePicker2, {
                            value: tempDateRange[1],
                            minDate: tempDateRange[0],
                            onChange: (newValue) => setTempDateRange([tempDateRange[0], newValue])
                        })}
                    </Box>
                    <Divider />
                    <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                        <Button onClick={onClose}>Hủy</Button>
                        <Button variant="contained" onClick={handleApplyCustomDate}>Áp dụng</Button>
                    </Box>
                </Box>
            </Box>
        </Menu>
    );
}

export default DateRangeFilterMenu;