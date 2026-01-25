import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button,
    IconButton, Box, FormControl, InputLabel, Select, MenuItem, 
    FormHelperText, TextField, InputAdornment, LinearProgress, Typography
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DownloadIcon from '@mui/icons-material/Download';
import FileDropzone from './FileDropzone';
import { useNotification } from '../../context/NotificationContext';
import { uploadStandardFile } from '../../services/api';

const MAX_SOURCE_LENGTH = 20;
const DEFAULT_PLATFORMS = [ { key: 'shopee', name: 'Shopee' }, { key: 'tiktok', name: 'TikTok Shop' }];

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

function SingleImportDialog({ open, onClose, onUploadComplete, brandSlug }) {
    const { showNotification } = useNotification();
    const [platforms, setPlatforms] = useState(() => [...DEFAULT_PLATFORMS, ...getCustomPlatforms(brandSlug)]);
    const [selectedPlatform, setSelectedPlatform] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isWorking, setIsWorking] = useState(false);
    const [progress, setProgress] = useState(0);
    const [progressText, setProgressText] = useState('');
    const [customSource, setCustomSource] = useState('');
    const [customSourceError, setCustomSourceError] = useState('');
    const [isSelectOpen, setIsSelectOpen] = useState(false); // State để kiểm soát Select
    const [confirmOpen, setConfirmOpen] = useState(false); // State cho hộp thoại xác nhận ghi đè
    const intervalRef = useRef(null);

    useEffect(() => {
        if (open) {
            setPlatforms([...DEFAULT_PLATFORMS, ...getCustomPlatforms(brandSlug)]);
            setSelectedPlatform('');
            setSelectedFile(null);
            setIsWorking(false);
            setProgress(0);
            setProgressText('');
            setCustomSource('');
            setCustomSourceError('');
            setIsSelectOpen(false); // Reset trạng thái Select
            setConfirmOpen(false);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
    }, [open, brandSlug]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    const handleAddCustomSource = () => {
        if (!brandSlug) {
            setCustomSourceError('Cần có Brand Slug.');
            return;
        }
        const trimmedSource = customSource.trim();
        if (!trimmedSource) {
            setCustomSourceError('Tên không được để trống.');
            return;
        }
        if (trimmedSource.length > MAX_SOURCE_LENGTH) {
            setCustomSourceError(`Tối đa ${MAX_SOURCE_LENGTH} ký tự.`);
            return;
        }
        const newPlatformKey = trimmedSource.toLowerCase().replace(/\s+/g, '_');
        if (platforms.some(p => p.key === newPlatformKey)) {
            setCustomSourceError('Sàn này đã tồn tại.');
            return;
        }
        const newPlatform = { key: newPlatformKey, name: trimmedSource };
        const updatedCustomPlatforms = [...getCustomPlatforms(brandSlug), newPlatform];
        saveCustomPlatforms(brandSlug, updatedCustomPlatforms);
        setPlatforms([...DEFAULT_PLATFORMS, ...updatedCustomPlatforms]);
        setSelectedPlatform(newPlatformKey);
        setCustomSource('');
        setCustomSourceError('');
        setIsSelectOpen(false); // Đóng Select sau khi thêm thành công
    };

    const handleConfirmOverwrite = () => {
        setConfirmOpen(false);
        handleUpload(true); // Gọi lại upload với force=true
    };

    const handleUpload = async (force = false) => {
        if (!selectedFile || !selectedPlatform || !brandSlug) return;

        setIsWorking(true);
        setProgress(0);
        setProgressText('Đang tải lên và xử lý...');
        
        // [UX] Tiến trình ảo thông minh:
        // - Chạy nhanh đến 70% (Upload)
        // - Chạy chậm dần đến 90% (Server nhận)
        // - Nhích từng chút một 90-99% (Worker tính toán)
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                if (prev < 70) return prev + 5;      // Giai đoạn đầu nhanh
                if (prev < 90) return prev + 2;      // Giai đoạn giữa chậm lại
                if (prev < 99) return prev + 0.2;    // Giai đoạn cuối (Worker) nhích rất chậm
                return prev; // Giữ nguyên ở 99% nếu chưa xong
            });
        }, 400);

        try {
            // Backend bây giờ sẽ chờ Worker tính xong mới trả lời (tối đa 60s)
            await uploadStandardFile(selectedPlatform, brandSlug, selectedFile, force);
            
            // Khi Backend trả lời xong, nghĩa là 100% hoàn tất
            if (intervalRef.current) clearInterval(intervalRef.current);
            setProgress(100);
            setProgressText('Hoàn thành!');
            
            // [UX] Đợi 500ms để người dùng kịp nhìn thấy 100%
            await new Promise(resolve => setTimeout(resolve, 500));
            
            await onUploadComplete();

            setTimeout(() => onClose(), 500);

        } catch (error) {
            const errorMessage = error.response?.data?.detail || error.message || 'Lỗi khi upload hoặc xử lý file.';
            
            // Kiểm tra xem lỗi có phải do trùng file không (dựa vào thông báo lỗi từ backend)
            if (!force && (errorMessage.includes('đã được import') || errorMessage.includes('Ghi đè'))) {
                setConfirmOpen(true);
                // Dừng progress bar nhưng không tắt isWorking hẳn để giữ UI mượt, hoặc tắt để user bấm nút confirm
                setIsWorking(false);
                setProgress(0);
            } else {
                showNotification(errorMessage, 'error');
                setIsWorking(false);
                setProgress(0);
            }
            
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
    };
    
    return (
        <>
            <Dialog open={open} onClose={() => !isWorking && onClose()} maxWidth="sm" fullWidth
                onKeyDown={(e) => {
                    // Chỉ kích hoạt handleUpload khi Enter được nhấn và tất cả các điều kiện để upload đều hợp lệ
                    if (e.key === 'Enter' && selectedFile && selectedPlatform && !isWorking) {
                        e.preventDefault(); // Ngăn hành vi mặc định của Enter
                        handleUpload();
                    }
                }}
            >
                <DialogTitle>
                    Import Dữ liệu
                    <IconButton onClick={() => !isWorking && onClose()} sx={{ position: 'absolute', right: 16, top: 16, color: 'text.secondary' }} disabled={isWorking}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent>
                    <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <FormControl fullWidth disabled={isWorking}>
                            <InputLabel>Chọn Sàn Hoặc Thêm Mới</InputLabel>
                            <Select 
                                open={isSelectOpen} 
                                onOpen={() => setIsSelectOpen(true)} 
                                onClose={() => setIsSelectOpen(false)}
                                value={selectedPlatform} 
                                label="Chọn Sàn Hoặc Thêm Mới" 
                                onChange={(e) => {
                                    setSelectedPlatform(e.target.value);
                                    setIsSelectOpen(false); // Đóng lại khi chọn item có sẵn
                                }}
                            >
                                {platforms.map((platform) => (
                                    <MenuItem 
                                        key={platform.key} 
                                        value={platform.key}
                                        sx={{
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
                                        {platform.name}
                                    </MenuItem>
                                ))}
                                <Box sx={{ p: 2, borderTop: '1px solid rgba(255, 255, 255, 0.1)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
                                    <TextField
                                        fullWidth
                                        variant="standard"
                                        size="small"
                                        placeholder="Nhập tên sàn khác..."
                                        value={customSource}
                                        onChange={(e) => { setCustomSource(e.target.value); setCustomSourceError(''); }}
                                        error={!!customSourceError}
                                        helperText={customSourceError}
                                        inputProps={{ maxLength: MAX_SOURCE_LENGTH }}
                                        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); handleAddCustomSource(); } }}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton onClick={handleAddCustomSource} edge="end" size="small" color="primary">
                                                        <AddCircleOutlineIcon />
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                    />
                                </Box>
                            </Select>
                            <FormHelperText>Chọn sàn có sẵn hoặc nhập tên mới để thêm.</FormHelperText>
                        </FormControl>

                        <Box sx={{ opacity: selectedPlatform && !isWorking ? 1 : 0.5, pointerEvents: selectedPlatform && !isWorking ? 'auto' : 'none', transition: 'opacity 0.3s ease' }}>
                            <FileDropzone title="Tải lên File Template" onFileChange={setSelectedFile} />
                        </Box>

                        {isWorking && (
                            <Box sx={{ width: '100%' }}>
                                <LinearProgress variant="determinate" value={progress} />
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                                    {`${progressText} ${Math.round(progress)}%`}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </DialogContent>

                <DialogActions>
                    <Button href="/Standard_Template.xlsx" download="Standard_Template.xlsx" startIcon={<DownloadIcon />} color="inherit" size="small" sx={{ mr: 'auto', opacity: 0.7 }}>
                        Tải file mẫu
                    </Button>
                    <Button onClick={() => !isWorking && onClose()} disabled={isWorking} color="inherit"> Hủy </Button>
                    <Button onClick={() => handleUpload(false)} variant="contained" disabled={!selectedFile || !selectedPlatform || isWorking}>
                        {isWorking ? 'Đang xử lý...' : 'Bắt đầu Import'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Dialog xác nhận ghi đè */}
            <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Xác nhận ghi đè</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        File này đã tồn tại trong hệ thống. Bạn có chắc chắn muốn ghi đè dữ liệu cũ không?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmOpen(false)} color="inherit">Hủy</Button>
                    <Button onClick={handleConfirmOverwrite} color="primary" autoFocus>Đồng ý</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default SingleImportDialog;