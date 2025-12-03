1 // frontend/src/components/common/MultiSelectFilter.jsx
import React, { useState, useEffect } from 'react';
import { Box, Button, Menu, MenuItem, Checkbox, ListItemText, Typography, Divider, Badge } from '@mui/material';
import {
    FilterList as FilterListIcon,
    ArrowDropDown as ArrowDropDownIcon,
    Check as CheckIcon
} from '@mui/icons-material';
/**
 * Component Dropdown Multi-Select tái sử dụng.
 *
 * @param {string} label - Nhãn hiển thị trên nút (VD: "Nguồn", "Chỉ số").
 * @param {Array} options - Danh sách lựa chọn. Format: [{ value: 'shopee', label: 'Shopee' }, ...]
 * @param {Array} selectedValues - Danh sách các value đang được chọn (VD: ['shopee', 'tiktok']).
 * @param {Function} onApply - Callback chạy khi bấm nút "Áp dụng". Trả về mảng value mới.
 * @param {string} allValue - Giá trị đại diện cho "Tất cả" (mặc định là 'all').
 */
const MultiSelectFilter = ({
    label = "Bộ lọc",
    options = [],           // [{ value: 'shopee', label: 'Shopee' }]
    selectedValues = [],    // ['shopee', 'lazada'] hoặc ['all']
    onApply,
    allValue = 'all'
}) => {
    const [anchorEl, setAnchorEl] = useState(null);
    // State tạm thời để lưu lựa chọn khi đang mở menu (chưa bấm Áp dụng)
    const [tempSelected, setTempSelected] = useState([]);
    const open = Boolean(anchorEl);

    // Đồng bộ state tạm thời mỗi khi mở menu hoặc props thay đổi
    useEffect(() => {
        setTempSelected(selectedValues);
    }, [selectedValues, open]);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
        // Reset lại temp về giá trị gốc nếu đóng mà không apply
        setTempSelected(selectedValues);
    };

    const handleToggle = (value) => {
        // Logic chọn "Tất cả"
        if (value === allValue) {
            // Nếu đang chọn All -> Bỏ chọn hết. Nếu chưa -> Chọn hết (trừ All ra, hoặc gán bằng All tuỳ logic BE)
            // Ở đây ta giả định logic: Nếu chọn All thì mảng chỉ chứa ['all']
            setTempSelected([allValue]);
            return;
        }

        // Logic chọn item thường
        let newSelected = [...tempSelected];

        // Nếu đang là 'all', xóa 'all' đi để bắt đầu chọn lẻ
        if (newSelected.includes(allValue)) {
            newSelected = [];
        }

        const currentIndex = newSelected.indexOf(value);
        if (currentIndex === -1) {
            newSelected.push(value); // Chọn
        } else {
            newSelected.splice(currentIndex, 1); // Bỏ chọn
        }

        // Nếu bỏ chọn hết sạch -> Tự động về All (hoặc rỗng tuỳ ý, ở đây để rỗng cho user tự quyết)
        if (newSelected.length === 0) {
            newSelected = [allValue];
        }

        setTempSelected(newSelected);
    };

    const handleApply = () => {
        if (onApply) {
            onApply(tempSelected);
        }
        setAnchorEl(null);
    };

    // Hiển thị số lượng đang chọn trên nút
    const isAllSelected = tempSelected.includes(allValue) || tempSelected.length === 0;
    const displayCount = isAllSelected ? 'Tất cả' : tempSelected.length;
    return (
         <Box>
             <Button
                 variant="outlined"
                 onClick={handleClick}
                 endIcon={<ArrowDropDownIcon />}
                 startIcon={<FilterListIcon />}
                 sx={{
                     borderRadius: 2,
                    textTransform: 'none',
                    borderColor: (theme) => open ? theme.palette.primary.main : theme.palette.divider,
                    color: (theme) => open ? theme.palette.primary.main : theme.palette.text.secondary,
                    minWidth: 120,
                    justifyContent: 'space-between'
                }}
            >
                {label}
                {/* Badge hiển thị số lượng */}
                {!isAllSelected && (
                    <Box
                        component="span"
                        sx={{
                            ml: 1,
                            bgcolor: 'primary.main',
                            color: 'white',
                            borderRadius: '50%',
                            width: 20,
                            height: 20,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {displayCount}
                    </Box>
                )}
            </Button>
             <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                PaperProps={{
                    sx: { width: 250, maxHeight: 400 }
                }}
            >
               <Box sx={{ p: 2, pb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Chọn {label.toLowerCase()}
                    </Typography>
                </Box>
                <Divider />
                 {/* Option: Tất cả */}
                <MenuItem onClick={() => handleToggle(allValue)} dense>
                    <Checkbox
                        checked={tempSelected.includes(allValue)}
                        size="small"
                    />
                    <ListItemText primary="Tất cả" />
               </MenuItem>
                 <Divider sx={{ my: 0.5 }} />
                 {/* Danh sách Options động */}
                {options.map((option) => (
                    <MenuItem key={option.value} onClick={() => handleToggle(option.value)} dense>
                        <Checkbox
                            checked={tempSelected.includes(option.value)}
                            size="small"
                        />
                        <ListItemText primary={option.label} />
                    </MenuItem>
                ))}
                 <Divider sx={{ my: 1 }} />
                 {/* Footer: Nút bấm */}
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    <Button onClick={handleClose} size="small" color="inherit">
                        Hủy
                    </Button>
                    <Button
                        onClick={handleApply}
                        size="small"
                        variant="contained"
                        startIcon={<CheckIcon />}
                    >
                        Áp dụng
                    </Button>
                </Box>
            </Menu>
        </Box>
    );
};

export default MultiSelectFilter;