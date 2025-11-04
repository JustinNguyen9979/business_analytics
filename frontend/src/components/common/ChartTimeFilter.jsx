// FILE: frontend/src/components/common/ChartTimeFilter.jsx (PHIÊN BẢN NÂNG CẤP THEO YÊU CẦU)

import React, { useState, useEffect } from 'react';
import { Button, Menu, MenuItem, Box, Typography, List, ListItemButton, ListItemText } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);

const generateYears = () => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
};

// <<< CẬP NHẬT HÀM FORMAT ĐỂ HIỂN THỊ ĐA DẠNG HƠN >>>
const formatSelectionDetail = (range, type) => {
    const [start, end] = range;
    if (!start) return 'Tất cả thời gian';

    switch (type) {
        case 'year':
            return `Năm ${start.year()}`;
        case 'quarter':
            return `Quý ${start.quarter()} / ${start.year()}`;
        case 'month':
            // Nếu là chọn 1 tháng
            if (start.isSame(end, 'month')) {
                return `Tháng ${start.month() + 1} / ${start.year()}`;
            }
            // Nếu là khoảng thời gian nhiều tháng
            return `T${start.month() + 1} - T${end.month() + 1} / ${start.year()}`;
        default:
            return '';
    }
};

function ChartTimeFilter({ onFilterChange }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const years = generateYears();
    const open = Boolean(anchorEl);

    // <<< BƯỚC 1: TÁI CẤU TRÚC LẠI STATE ĐỂ QUẢN LÝ TỐT HƠN >>>
    // State lưu trữ bộ lọc đang được áp dụng
    const [activeFilter, setActiveFilter] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    
    // State chỉ để quản lý năm đang được hover, phục vụ cho việc hiển thị tháng/quý
    const [hoverYear, setHoverYear] = useState(dayjs().year());

    // State quản lý quá trình chọn nhiều tháng [ngày bắt đầu, ngày kết thúc]
    const [monthSelection, setMonthSelection] = useState([null, null]);

    // Tự động gọi onFilterChange khi component được tải lần đầu
    useEffect(() => {
        onFilterChange(activeFilter.range, activeFilter.type);
    }, []);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
        // Khi mở menu, reset lại năm hover về năm của bộ lọc hiện tại
        setHoverYear(activeFilter.range[0].year());
        // Reset lại quá trình chọn tháng
        setMonthSelection([null, null]);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    // Hàm chung để áp dụng bộ lọc
    const applyFilter = (newRange, type) => {
        setActiveFilter({ range: newRange, type });
        onFilterChange(newRange, type);
        handleClose();
    };
    
    // <<< BƯỚC 2: LOGIC MỚI CHO VIỆC CHỌN NĂM VÀ QUÝ >>>
    const handleYearClick = (year) => {
        const newRange = [dayjs().year(year).startOf('year'), dayjs().year(year).endOf('year')];
        applyFilter(newRange, 'year');
    };

    const handleQuarterClick = (quarter) => {
        const newRange = [dayjs().year(hoverYear).quarter(quarter).startOf('quarter'), dayjs().year(hoverYear).quarter(quarter).endOf('quarter')];
        applyFilter(newRange, 'quarter');
    };

    // <<< BƯỚC 3: LOGIC MỚI CHO VIỆC CHỌN NHIỀU THÁNG >>>
    const handleMonthClick = (monthIndex) => { // monthIndex từ 0 đến 11
        const clickedDate = dayjs().year(hoverYear).month(monthIndex);
        
        const [start] = monthSelection;

        // Nếu chưa chọn tháng bắt đầu, hoặc đã chọn xong 1 cặp -> Bắt đầu 1 lượt chọn mới
        if (!start) {
            setMonthSelection([clickedDate.startOf('month'), null]);
            return;
        }

        // Nếu đã chọn tháng bắt đầu -> Đây là lượt click thứ 2 để chọn tháng kết thúc
        let newRange = [start, clickedDate.endOf('month')];
        
        // Đảm bảo ngày bắt đầu luôn nhỏ hơn ngày kết thúc
        if (newRange[1].isBefore(newRange[0])) {
            newRange = [clickedDate.startOf('month'), start.endOf('month')];
        }
        
        applyFilter(newRange, 'month');
    };


    // <<< BƯỚC 4: TẠO STYLE CHUNG ĐỂ DỄ QUẢN LÝ >>>
    // Style cho item đang được chọn
    const selectedSx = {
        backgroundColor: 'primary.main',
        color: 'primary.contrastText',
        '&:hover': {
            backgroundColor: 'primary.dark',
        }
    };
    // Style cho item đang được hover (nhưng chưa chọn)
    const hoverSx = {
         '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.08)'
        }
    };
    // Style cho tháng đang trong quá trình chọn
     const selectingSx = {
        backgroundColor: 'rgba(0, 191, 255, 0.2)', // Màu xanh nhạt
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary">
                {formatSelectionDetail(activeFilter.range, activeFilter.type)}
            </Typography>
            <Button
                variant="outlined"
                onClick={handleClick}
                endIcon={<KeyboardArrowDownIcon />}
            >
                Bộ lọc
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{ sx: { mt: 1, backdropFilter: 'blur(15px)', backgroundColor: 'rgba(30, 41, 59, 0.8)' } }}
            >
                <Box sx={{ display: 'flex' }}>
                    
                    {/* --- CỘT THÁNG --- */}
                    <Box sx={{ width: 120, pl: 1 }}>
                        <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Tháng</Typography>
                        <List component="nav" dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                            {Array.from({ length: 12 }, (_, i) => i).map(monthIndex => {
                                const isSelected = activeFilter.type === 'month' &&
                                    activeFilter.range[0].year() === hoverYear &&
                                    dayjs().month(monthIndex).isBetween(activeFilter.range[0], activeFilter.range[1], 'month', '[]');
                                
                                const isSelecting = monthSelection[0] && monthSelection[0].month() === monthIndex && monthSelection[0].year() === hoverYear;

                                return (
                                    <ListItemButton 
                                        key={monthIndex}
                                        onClick={() => handleMonthClick(monthIndex)}
                                        // <<< SỬA LẠI LOGIC HIỂN THỊ STYLE >>>
                                        sx={ isSelected ? selectedSx : (isSelecting ? selectingSx : hoverSx) }
                                    >
                                        <ListItemText primary={`Tháng ${monthIndex + 1}`} />
                                    </ListItemButton>
                                );
                            })}
                        </List>
                    </Box>

                    {/* --- CỘT QUÝ --- */}
                     <Box sx={{ width: 120, borderRight: 1, borderColor: 'divider', pr: 1 }}>
                         <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Quý</Typography>
                         <List component="nav" dense>
                            {[1, 2, 3, 4].map(q => (
                                <ListItemButton 
                                    key={q}
                                    onClick={() => handleQuarterClick(q)}
                                    // <<< SỬA LẠI LOGIC HIỂN THỊ STYLE >>>
                                    sx={
                                        activeFilter.type === 'quarter' && 
                                        activeFilter.range[0].year() === hoverYear && 
                                        activeFilter.range[0].quarter() === q 
                                        ? selectedSx 
                                        : hoverSx
                                    }
                                >
                                    <ListItemText primary={`Quý ${q}`} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                    
                    {/* --- CỘT NĂM --- */}
                    <Box sx={{ borderRight: 1, borderColor: 'divider', width: 140 }}>
                        <List component="nav" dense>
                            {years.map(year => (
                                <ListItemButton
                                    key={year}
                                    onMouseEnter={() => setHoverYear(year)}
                                    onClick={() => handleYearClick(year)}
                                    // <<< SỬA LẠI LOGIC HIỂN THỊ STYLE >>>
                                    sx={activeFilter.type === 'year' && activeFilter.range[0].year() === year ? selectedSx : hoverSx}
                                >
                                    <ListItemText primary={`Năm ${year}`} />
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