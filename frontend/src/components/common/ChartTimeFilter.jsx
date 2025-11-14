// FILE: frontend/src/components/common/ChartTimeFilter.jsx 

import React, { useState, useEffect } from 'react';
import { Button, Menu, Box, Typography, List, ListItemButton, ListItemText } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import isBetween from 'dayjs/plugin/isBetween';
import minMax from 'dayjs/plugin/minMax';

dayjs.extend(minMax);
dayjs.extend(quarterOfYear);
dayjs.extend(isBetween);

const generateYears = () => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
};

const formatSelectionDetail = (filterValue) => {
    // <<< THÊM BỘ KIỂM TRA AN TOÀN >>>
    if (!filterValue || !filterValue.range || !filterValue.range[0]) return 'Đang tải...';
    
    const { range, type } = filterValue;
    const [start, end] = range;

    switch (type) {
        case 'year': return `Năm ${start.year()}`;
        case 'quarter': return `Quý ${start.quarter()} / ${start.year()}`;
        case 'month':
            if (start.isSame(end, 'month')) return `Tháng ${start.month() + 1} / ${start.year()}`;
            return `T${start.month() + 1} - T${end.month() + 1} / ${start.year()}`;
        default: return 'Tùy chỉnh';
    }
};

function ChartTimeFilter({ value, onChange }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const years = generateYears();
    const open = Boolean(anchorEl);
    const [tempRangeStart, setTempRangeStart] = useState(null);

    const initialYear = (value && value.range && value.range[0]) ? value.range[0].year() : dayjs().year();
    const [hoverYear, setHoverYear] = useState(initialYear);

    useEffect(() => {
        if (!open) {
            setTempRangeStart(null);
        }
    }, [open]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
        // Cập nhật hoverYear từ giá trị prop hiện tại khi mở menu
        const currentYear = (value && value.range && value.range[0]) ? value.range[0].year() : dayjs().year();
        setHoverYear(currentYear);
    };

    const handleClose = () => setAnchorEl(null);

    const applyFilter = (newRange, type) => {
        if (typeof onChange === 'function') {
            onChange(newRange, type);
        }
        handleClose();
    };
    
    const handleYearClick = (year) => {
        const newRange = [dayjs().year(year).startOf('year'), dayjs().year(year).endOf('year')];
        applyFilter(newRange, 'year');
    };

    const handleQuarterClick = (quarter) => {
        const newRange = [dayjs().year(hoverYear).quarter(quarter).startOf('quarter'), dayjs().year(hoverYear).quarter(quarter).endOf('quarter')];
        applyFilter(newRange, 'quarter');
    };

    const handleMonthClick = (monthIndex) => {
        const clickedDate = dayjs().year(hoverYear).month(monthIndex);

        // --- TRƯỜNG HỢP 1: Đây là cú click ĐẦU TIÊN để bắt đầu chọn khoảng ---
        if (!tempRangeStart) {
            setTempRangeStart(clickedDate);
            return; // Dừng lại và chờ cú click thứ hai
        }

        // --- TRƯỜNG HỢP 2: Click LẦN THỨ HAI vào CÙNG một tháng (xem 1 tháng) ---
        if (clickedDate.isSame(tempRangeStart, 'month')) {
            const newRange = [clickedDate.startOf('month'), clickedDate.endOf('month')];
            applyFilter(newRange, 'month');
            setTempRangeStart(null); // Reset lại
            return;
        }
        
        // --- TRƯỜNG HỢP 3: Click LẦN THỨ HAI vào một tháng KHÁC (hoàn tất chọn khoảng) ---
        // Sắp xếp để đảm bảo ngày bắt đầu luôn nhỏ hơn ngày kết thúc
        const newStart = dayjs.min(tempRangeStart, clickedDate);
        const newEnd = dayjs.max(tempRangeStart, clickedDate);

        const newRange = [newStart.startOf('month'), newEnd.endOf('month')];
        applyFilter(newRange, 'month');
        setTempRangeStart(null); // Reset lại sau khi đã áp dụng
    };

    const selectedSx = { backgroundColor: 'primary.main', color: 'primary.contrastText', '&:hover': { backgroundColor: 'primary.dark' } };
    const hoverSx = { '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.08)' } };
    
    // Thêm một lần kiểm tra an toàn nữa trước khi render
    if (!value || !value.range) return null;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary">
                {formatSelectionDetail(value)}
            </Typography>
            <Button variant="outlined" onClick={handleClick} endIcon={<KeyboardArrowDownIcon />} sx={{ px: 4 }}>
                Bộ lọc
            </Button>
            <Menu anchorEl={anchorEl} open={open} onClose={handleClose} PaperProps={{ sx: { mt: 1, backdropFilter: 'blur(15px)', backgroundColor: 'rgba(30, 41, 59, 0.8)' } }}>
                <Box sx={{ display: 'flex' }}>
                    {/* Cột Tháng */}
                    <Box sx={{ width: 120 }}>
                        <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Tháng</Typography>
                        <List component="nav" dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {Array.from({ length: 12 }, (_, i) => {
                                // <<< BƯỚC 4: Logic hiển thị phức tạp hơn để làm nổi bật khoảng đang chọn
                                const currentMonth = dayjs().year(hoverYear).month(i);
                                
                                // Điều kiện 1: Tháng này có nằm trong khoảng đã được chọn cuối cùng không?
                                const isSelected = value.type === 'month' 
                                    && currentMonth.year() === value.range[0].year() 
                                    && currentMonth.isBetween(value.range[0], value.range[1], 'month', '[]');

                                // Điều kiện 2: Tháng này có phải là điểm bắt đầu của khoảng đang chọn tạm thời không?
                                const isTempStart = tempRangeStart && currentMonth.isSame(tempRangeStart, 'month');

                                return (
                                    <ListItemButton 
                                        key={i} 
                                        onClick={() => handleMonthClick(i)} 
                                        // Áp dụng style nếu 1 trong 2 điều kiện trên là đúng
                                        sx={isSelected || isTempStart ? selectedSx : hoverSx}
                                    >
                                        <ListItemText primary={`Tháng ${i + 1}`} />
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>
                    {/* Cột Quý */}
                     <Box sx={{ borderRight: 1, borderColor: 'divider', width: 120 }}>
                         <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Quý</Typography>
                         <List component="nav" dense>
                            {[1, 2, 3, 4].map(q => {
                                const isSelected = value.type === 'quarter' && value.range[0].year() === hoverYear && value.range[0].quarter() === q;
                                return ( <ListItemButton key={q} onClick={() => handleQuarterClick(q)} sx={isSelected ? selectedSx : hoverSx}> <ListItemText primary={`Quý ${q}`} /> </ListItemButton> );
                            })}
                        </List>
                    </Box>
                    {/* Cột Năm */}
                    <Box sx={{ borderRight: 1, borderColor: 'divider', width: 140 }} onMouseLeave={() => setHoverYear(value.range[0].year())}>
                        <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Năm</Typography>
                        <List component="nav" dense>
                            {years.map(year => (
                                <ListItemButton key={year} onMouseEnter={() => setHoverYear(year)} onClick={() => handleYearClick(year)}
                                    sx={value.type === 'year' && value.range[0].year() === year ? selectedSx : hoverSx}>
                                    <ListItemText primary={`${year}`} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                </Box>
            </Menu>
        </Box>
    );
}

export default ChartTimeFilter;