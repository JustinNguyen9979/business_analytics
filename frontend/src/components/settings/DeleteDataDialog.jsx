import React, { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    IconButton, CircularProgress, Box, TextField, Typography, Alert,
    FormControl, InputLabel, Select, MenuItem
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import dayjs from 'dayjs';

import DateRangeFilterMenu from '../common/DateRangeFilterMenu';
import { dateShortcuts } from '../../config/dashboardConfig';
import { getAllBrands, getSourcesForBrand, deleteDataInRange } from '../../services/api';
import { useNotification } from '../../context/NotificationContext';

// const defaultDateRange = dateShortcuts.find(s => s.type === 'this_month').getValue();
// const defaultDateLabel = dateShortcuts.find(s => s.type === 'this_month').label;

function DeleteDataDialog({ open, onClose, brandId }) {
    const [dateRange, setDateRange] = useState(null);
    const [dateLabel, setDateLabel] = useState('Chọn khoảng thời gian');

    const [brandName, setBrandName] = useState('');
    // const [dateRange, setDateRange] = useState(defaultDateRange);
    // const [dateLabel, setDateLabel] = useState(defaultDateLabel);
    const [anchorEl, setAnchorEl] = useState(null);
    const [confirmationText, setConfirmationText] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [sources, setSources] = useState([]);
    const [selectedSource, setSelectedSource] = useState('all');
    const { showNotification } = useNotification();

    // Fetch brand name and sources when the dialog opens
    useEffect(() => {
        if (open && brandId) {
            const fetchData = async () => {
                try {
                    // Fetch brand name
                    const brands = await getAllBrands();
                    const currentBrand = brands.find(b => b.id.toString() === brandId);
                    if (currentBrand) {
                        setBrandName(currentBrand.name);
                    }

                    // Fetch sources
                    const fetchedSources = await getSourcesForBrand(brandId);
                    console.log("Fetched sources for brand:", brandId, fetchedSources);
                    setSources(['all', ...fetchedSources]);

                } catch (error) {
                    showNotification('Không thể tải dữ liệu cần thiết (brand hoặc sources).', 'error');
                }
            };
            fetchData();
        } else {
            // Reset state when closing
            setBrandName('');
            setDateRange(null);
            setDateLabel('Chọn khoảng thời gian');
            setConfirmationText('');
            setIsDeleting(false);
            setSources([]);
            setSelectedSource('all');
        }
    }, [open, brandId, showNotification]);

    const handleOpenFilter = (event) => setAnchorEl(event.currentTarget);
    const handleCloseFilter = () => setAnchorEl(null);

    const handleApplyDateRange = (newRange, newLabelType) => {
        const newLabel = dateShortcuts.find(s => s.type === newLabelType)?.label || 
                         `${newRange[0].format('DD/MM')} - ${newRange[1].format('DD/MM/YYYY')}`;
        setDateRange(newRange);
        setDateLabel(newLabel);
        handleCloseFilter();
    };

    // Generate the expected confirmation text based on selected source
    const expectedConfirmationText = selectedSource === 'all'
        ? `delete_${brandName.toLowerCase().replace(/\s/g, '_')}`
        : `delete_${selectedSource.toLowerCase().replace(/\s/g, '_')}`;

    const handleDelete = async () => {
        if (confirmationText !== expectedConfirmationText || !dateRange) return;

        setIsDeleting(true);
        try {
            const [start, end] = dateRange;
            await deleteDataInRange(brandId, start.format('YYYY-MM-DD'), end.format('YYYY-MM-DD'), selectedSource === 'all' ? null : selectedSource);
            showNotification('Xóa dữ liệu thành công! Trang sẽ được tải lại.', 'success');
            // Reload the page after a short delay to allow the user to read the notification
            setTimeout(() => {
                window.location.reload();
            }, 2000);
            onClose();
        } catch (error) {
            showNotification(error.response?.data?.detail || 'Lỗi khi xóa dữ liệu.', 'error');
            setIsDeleting(false);
        }
    };

    const isConfirmEnabled = confirmationText === expectedConfirmationText && dateRange !== null;

    const deletionTargetText = selectedSource === 'all'
        ? `tất cả các nguồn dữ liệu của brand ${brandName}`
        : `nguồn dữ liệu "${selectedSource}" của brand ${brandName}`;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Xóa Dữ Liệu Giao Dịch
                <IconButton edge="end" color="inherit" onClick={onClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
                    <Alert severity="error" variant="filled">
                        <Typography variant="h6" component="div">Hành động cực kỳ nguy hiểm!</Typography>
                        <Typography variant="body2">
                            Toàn bộ dữ liệu giao dịch của {deletionTargetText} trong khoảng thời gian đã chọn sẽ bị **xóa vĩnh viễn**. Hành động này không thể hoàn tác.
                        </Typography>
                    </Alert>

                    <Box>
                        <Typography gutterBottom>1. Chọn bộ lọc để xóa:</Typography>
                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                startIcon={<CalendarTodayIcon />}
                                onClick={handleOpenFilter}
                                sx={{ flexGrow: 1 }}
                            >
                                {dateLabel}
                            </Button>
                            <FormControl sx={{ width: 300, flexShrink: 0 }}>
                                <InputLabel id="source-select-label">Nguồn Dữ liệu</InputLabel>
                                <Select
                                    labelId="source-select-label"
                                    value={selectedSource}
                                    label="Nguồn Dữ liệu"
                                    onChange={(e) => setSelectedSource(e.target.value)}
                                    sx={{
                                        color: 'white', 
                                        '.MuiSelect-icon': {
                                            color: 'white',
                                        },
                                    }}
                                >
                                    {sources.map(source => (
                                        <MenuItem key={source} value={source}>
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
                        <Typography gutterBottom>2. Để xác nhận, vui lòng nhập <strong>"{expectedConfirmationText}"</strong> vào ô bên dưới:</Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            placeholder={`Nhập "${expectedConfirmationText}" để xác nhận`}
                            value={confirmationText}
                            onChange={(e) => setConfirmationText(e.target.value)}
                            error={confirmationText !== '' && confirmationText !== expectedConfirmationText}
                            helperText={
                                confirmationText !== '' && confirmationText !== expectedConfirmationText 
                                ? `Văn bản xác nhận không khớp. Vui lòng nhập "${expectedConfirmationText}".` 
                                : ''
                            }
                        />
                    </Box>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: '0 24px 16px' }}>
                <Button onClick={onClose} color="secondary" disabled={isDeleting}>
                    Hủy
                </Button>
                <Button
                    onClick={handleDelete}
                    variant="contained"
                    color="error"
                    disabled={!isConfirmEnabled || isDeleting}
                    startIcon={isDeleting ? <CircularProgress size={20} color="inherit" /> : null}
                >
                    {isDeleting ? 'Đang xóa...' : 'Xác nhận Xóa Dữ Liệu'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
export default DeleteDataDialog;
