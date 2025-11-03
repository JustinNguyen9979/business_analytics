// FILE: frontend/src/components/common/ChartTimeFilter.jsx (PHIÊN BẢN SỬA LỖI RELOAD CUỐI CÙNG)

import React, { useState } from 'react'; // Bỏ useEffect
import { Button, Menu, MenuItem, Box, Typography, List, ListItemButton, ListItemText, Divider } from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import dayjs from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
dayjs.extend(quarterOfYear);

const generateYears = () => {
    const currentYear = dayjs().year();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
};

const formatSelectionDetail = (range, type) => {
    const [start] = range;
    if (!start) return '';
    switch (type) {
        case 'year':
            return `Năm ${start.year()}`;
        case 'quarter':
            return `Quý ${start.quarter()} / ${start.year()}`;
        case 'month':
            return `Tháng ${start.month() + 1} / ${start.year()}`;
        default:
            return '';
    }
};

function ChartTimeFilter({ onFilterChange }) {
    const [anchorEl, setAnchorEl] = useState(null);
    const [currentSelection, setCurrentSelection] = useState({
        range: [dayjs().startOf('year'), dayjs().endOf('year')],
        type: 'year'
    });
    const [hoverYear, setHoverYear] = useState(dayjs().year());

    const open = Boolean(anchorEl);
    const years = generateYears();

    // <<< XÓA BỎ HOÀN TOÀN KHỐI useEffect GÂY LỖI Ở ĐÂY >>>

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
        setHoverYear(currentSelection.range[0].year());
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (newRange, type) => {
        setCurrentSelection({ range: newRange, type: type });
        onFilterChange(newRange, type);
        handleClose();
    };

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body1" color="text.secondary">
                {formatSelectionDetail(currentSelection.range, currentSelection.type)}
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

                    <Box sx={{ width: 120, pl: 1 }}>
                            <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Tháng</Typography>
                            <List component="nav" dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <ListItemButton key={m} onClick={() => handleSelect([dayjs().year(hoverYear).month(m - 1).startOf('month'), dayjs().year(hoverYear).month(m - 1).endOf('month')], 'month')}>
                                        <ListItemText primary={`Tháng ${m}`} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>

                    <Box sx={{ display: 'flex', p: 1 }}>
                        <Box sx={{ width: 120, borderRight: 1, borderColor: 'divider', pr: 1 }}>
                             <Typography sx={{ p: '6px 16px', fontWeight: 'bold' }}>Quý</Typography>
                             <List component="nav" dense>
                                {[1, 2, 3, 4].map(q => (
                                    <ListItemButton key={q} onClick={() => handleSelect([dayjs().year(hoverYear).quarter(q).startOf('quarter'), dayjs().year(hoverYear).quarter(q).endOf('quarter')], 'quarter')}>
                                        <ListItemText primary={`Quý ${q}`} />
                                    </ListItemButton>
                                ))}
                            </List>
                        </Box>
                        
                    <Box sx={{ borderRight: 1, borderColor: 'divider', width: 140 }}>
                        <List component="nav" dense>
                            {years.map(year => (
                                <ListItemButton
                                    key={year}
                                    selected={hoverYear === year}
                                    onMouseEnter={() => setHoverYear(year)}
                                    onClick={() => handleSelect([dayjs().year(year).startOf('year'), dayjs().year(year).endOf('year')], 'year')}
                                >
                                    <ListItemText primary={`Năm ${year}`} />
                                </ListItemButton>
                            ))}
                        </List>
                    </Box>
                    </Box>
                </Box>
            </Menu>
        </Box>
    );
}

export default ChartTimeFilter;