import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, CircularProgress, Box, TextField, Typography, Alert,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';

import DateRangeFilterMenu from '../common/DateRangeFilterMenu';
import { dateShortcuts } from '../../config/dashboardConfig';
import { getSourcesForBrand, deleteDataInRange } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';
import { filterButtonSx, T } from '../../theme/designSystem';

const getCustomPlatforms = (brandSlug) => {
    if (!brandSlug) return [];
    try {
        const saved = localStorage.getItem(`customPlatforms_${brandSlug}`);
        return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
};

const saveCustomPlatforms = (brandSlug, platforms) => {
    if (!brandSlug) return;
    localStorage.setItem(`customPlatforms_${brandSlug}`, JSON.stringify(platforms));
};

// --- COMPONENT ĐÃ ĐƯỢC TÁI CẤU TRÚC ---
// Nhận thẳng brandSlug và brandName từ props, không cần tự fetch
function DeleteDataDialog({ open, onClose, brandSlug, brandName }) {
    const [dateRange, setDateRange] = useState(null);
    const [dateLabel, setDateLabel] = useState('Chọn khoảng thời gian');
    const [anchorEl, setAnchorEl] = useState(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [sources, setSources] = useState(['all']);
    const [selectedSource, setSelectedSource] = useState('all');
    
    const { showNotification } = useNotification();

    useEffect(() => {
        // Nếu dialog không mở hoặc không có slug, reset state và dừng lại
        if (!open || !brandSlug) {
            setDateRange(null);
            setDateLabel('Chọn khoảng thời gian');
            setConfirmationText('');
            setIsDeleting(false);
            setSources(['all']);
            setSelectedSource('all');
            return;
        }

        // Logic duy nhất còn lại: fetch sources cho brand slug đã có
        const fetchSources = async () => {
            try {
                const fetchedSources = await getSourcesForBrand(brandSlug);
                setSources(['all', ...(fetchedSources || [])]);
            } catch (error) {
                console.error(`Lỗi khi tải sources cho slug '${brandSlug}':`, error);
                showNotification('Không thể tải danh sách nguồn dữ liệu.', 'error');
                setSources(['all']); // Fallback an toàn
            }
        };

        fetchSources();

    }, [open, brandSlug, showNotification]); // Phụ thuộc vào open và brandSlug

    const handleOpenFilter = (event) => setAnchorEl(event.currentTarget);
    const handleCloseFilter = () => setAnchorEl(null);

    const handleApplyDateRange = (newRange, newLabelType) => {
        const newLabel = dateShortcuts.find(s => s.type === newLabelType)?.label || 
                         `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        setDateRange(newRange);
        setDateLabel(newLabel);
        handleCloseFilter();
    };

    // Dùng trực tiếp brandName từ prop
    const expectedConfirmationText = selectedSource === 'all'
        ? (brandName ? `delete_${brandName.toLowerCase().replace(/\s/g, '_')}` : '')
        : `delete_${selectedSource.toLowerCase().replace(/\s/g, '_')}`;

    const handleDelete = async () => {
        if (confirmationText !== expectedConfirmationText || !dateRange || !brandSlug) return;

        setIsDeleting(true);
        try {
            const [start, end] = dateRange;
            const sourceParam = selectedSource === 'all' ? null : selectedSource;
            
            // API giờ sẽ trả về { message, fully_deleted_sources }
            const response = await deleteDataInRange(brandSlug, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), sourceParam);
            
            // Logic mới: Xử lý xóa source khỏi localStorage
            if (response && Array.isArray(response.fully_deleted_sources) && response.fully_deleted_sources.length > 0) {
                console.log('Các source sẽ bị xóa khỏi localStorage:', response.fully_deleted_sources);
                const currentCustomPlatforms = getCustomPlatforms(brandSlug);
                
                // Lọc bỏ những source đã bị xóa hoàn toàn
                const updatedCustomPlatforms = currentCustomPlatforms.filter(platform => 
                    !response.fully_deleted_sources.includes(platform.name.toLowerCase()) && 
                    !response.fully_deleted_sources.includes(platform.key)
                );

                if (updatedCustomPlatforms.length < currentCustomPlatforms.length) {
                    saveCustomPlatforms(brandSlug, updatedCustomPlatforms);
                    showNotification(`Đã xóa vĩnh viễn nguồn: ${response.fully_deleted_sources.join(', ')}.`, 'warning');
                }
            }
            
            showNotification('Xóa dữ liệu thành công!', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 2500); // Tăng nhẹ thời gian để user đọc kịp notification
            onClose();
        } catch (error) {
            showNotification(error.response?.data?.detail || 'Lỗi khi xóa dữ liệu.', 'error');
            setIsDeleting(false);
        }
    };

    const isConfirmEnabled = 
        confirmationText.trim().toLowerCase() === expectedConfirmationText.toLowerCase() && 
        dateRange !== null && 
        !!expectedConfirmationText;

    const deletionTargetText = selectedSource === 'all'
        ? `tất cả các nguồn dữ liệu của brand ${brandName || '...'}`
        : `nguồn dữ liệu "${selectedSource}" của brand ${brandName || '...'}`;

    return (
        <Dialog 
            open={open} 
            onClose={onClose} 
            maxWidth="sm" 
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        borderColor: 'error.main',
                        boxShadow: `0 0 40px rgba(255, 23, 68, 0.2), inset 0 0 20px rgba(255, 23, 68, 0.05)`,
                    }
                }
            }}
        >
            <DialogTitle sx={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                color: 'error.main', textShadow: '0 0 10px rgba(255, 23, 68, 0.5)'
            }}>
                Xóa DỮ LIỆU BÁO CÁO
                <IconButton edge="end" onClick={onClose} sx={{ color: 'text.secondary' }} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <Alert severity="error" variant="filled">
                        <Typography variant="subtitle1" component="div" fontWeight="bold">Hành động cực kỳ nguy hiểm!</Typography>
                        <Typography variant="body2">
                            Toàn bộ dữ liệu giao dịch của {deletionTargetText} trong khoảng thời gian đã chọn sẽ bị **xóa vĩnh viễn**. Hành động này không thể hoàn tác.
                        </Typography>
                    </Alert>

                    <Box>
                        <Typography gutterBottom color="text.primary">1. Chọn thời gian xóa:</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<CalendarMonthIcon />}
                                onClick={handleOpenFilter}
                                sx={{ ...filterButtonSx, flexGrow: 1 }}
                            >
                                {dateLabel}
                            </Button>
                            
                            <FormControl sx={{ width: 300, flexShrink: 0 }} size="small">
                                <InputLabel id="source-select-label" sx={{ 
                                    color: 'text.secondary', 
                                    '&.Mui-focused': { color: T.primary } 
                                }}>
                                    Nguồn Dữ liệu
                                </InputLabel>
                                <Select
                                    labelId="source-select-label"
                                    value={selectedSource}
                                    label="Nguồn Dữ liệu"
                                    onChange={(e) => setSelectedSource(e.target.value)}
                                    sx={{
                                        height: 44, // Đồng bộ với filterButtonSx
                                        borderRadius: T.radiusMd, // Đồng bộ bo góc
                                        color: 'text.primary',
                                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                        '& .MuiOutlinedInput-notchedOutline': {
                                            borderColor: T.border,
                                        },
                                        '&:hover .MuiOutlinedInput-notchedOutline': {
                                            borderColor: T.primary,
                                        },
                                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                            borderColor: T.primary,
                                            borderWidth: '1px'
                                        },
                                        '.MuiSelect-icon': { color: 'text.secondary' },
                                    }}
                                >
                                    {sources.map(source => (
                                        <MenuItem 
                                            key={source} 
                                            value={source}
                                            sx={{
                                                // Ghi đè trực tiếp màu nền của từng item
                                                backgroundColor: 'rgba(5, 10, 20, 0.85) !important', 
                                                '&:hover': {
                                                    backgroundColor: (theme) => `${theme.palette.action.hover} !important`,
                                                },
                                                '&.Mui-selected': {
                                                    backgroundColor: (theme) => `${theme.palette.action.selected} !important`,
                                                },
                                                '&.Mui-selected:hover': {
                                                    backgroundColor: (theme) => `${theme.palette.action.selected} !important`,
                                                },
                                            }}
                                        >
                                            {source === 'all' ? 'Tất cả các nguồn' : source}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        <DateRangeFilterMenu
                            open={Boolean(anchorEl)}
                            anchorEl={anchorEl}
                            onClose={handleCloseFilter}
                            initialDateRange={dateRange}
                            onApply={handleApplyDateRange}
                        />
                    </Box>

                    <Box>
                        <Typography gutterBottom color="text.primary">
                            2. Để xác nhận, vui lòng nhập <strong style={{ color: '#ff1744' }}>"{expectedConfirmationText}"</strong> vào ô bên dưới:
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder={expectedConfirmationText ? `Nhập "${expectedConfirmationText}" để xác nhận` : '...'}
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            error={confirmationText !== '' && confirmationText !== expectedConfirmationText}
                            helperText={
                                confirmationText !== '' && confirmationText !== expectedConfirmationText 
                                ? `Văn bản xác nhận không khớp.` 
                                : ''
                            }
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { borderColor: 'rgba(255, 255, 255, 0.2)' },
                                    '&:hover fieldset': { borderColor: 'error.main' },
                                    '&.Mui-focused fieldset': { borderColor: 'error.main' },
                                    input: { color: 'text.primary' }
                                }
                            }}
                        />
                    </Box>
                </Box>
            </DialogContent>
            
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button 
                    onClick={onClose} 
                    sx={{ 
                        color: 'text.secondary',
                        textTransform: 'none',
                        fontWeight: 600,
                        px: 3,
                        transition: 'all 0.3s ease',
                        border: '1px solid transparent',
                        '&:hover': {
                            color: T.primary,
                            backgroundColor: 'rgba(45, 212, 191, 0.05)',
                            borderColor: 'transparent',
                            // Thêm hiệu ứng phát sáng cho chữ
                            textShadow: `0 0 10px ${T.primary}80`,
                            // Thêm hiệu ứng phát sáng lan tỏa xung quanh (glow)
                            boxShadow: `0 0 15px ${T.primary}10`,
                        }
                    }}
                >
                    Hủy
                </Button>
                <Button
                    onClick={handleDelete}
                    variant="contained"
                    color="error"
                    disabled={!isConfirmEnabled || isDeleting}
                    startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
                    sx={{ boxShadow: '0 0 15px rgba(255, 23, 68, 0.4)' }}
                >
                    {isDeleting ? 'Đang xóa...' : 'Xác nhận Xóa Dữ Liệu'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default DeleteDataDialog;