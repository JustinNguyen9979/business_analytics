// FILE: frontend/src/components/common/ChartTimeFilter.jsx (PHIÊN BẢN AN TOÀN VÀ ĐƯỢC KIỂM SOÁT)

import React, { useState } from 'react';
import { Button, Menu, Box, Typography, List, ListItemButton, ListItemText } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);

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

    // <<< SỬA LỖI CRASH GỐC Ở ĐÂY >>>
    const initialYear = (value && value.range && value.range[0]) ? value.range[0].year() : dayjs().year();
    const [hoverYear, setHoverYear] = useState(initialYear);

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
        const newRange = [clickedDate.startOf('month'), clickedDate.endOf('month')];
        applyFilter(newRange, 'month');
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
                    {/* Cột Tháng */}
                    <Box sx={{ width: 120 }}>
                        <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Tháng</Typography>
                        <List component="nav" dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {Array.from({ length: 12 }, (_, i) => {
                                const isSelected = value.type === 'month' && value.range[0].year() === hoverYear && value.range[0].month() === i;
                                return ( <ListItemButton key={i} onClick={() => handleMonthClick(i)} sx={isSelected ? selectedSx : hoverSx} > <ListItemText primary={`Tháng ${i + 1}`} /> </ListItemButton> );
                            })}
                        </List>
                    </Box>
                </Box>
            </Menu>
        </Box>
    );
}

export default ChartTimeFilter;