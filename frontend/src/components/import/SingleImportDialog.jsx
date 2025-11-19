import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
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
    };

    const handleUpload = async () => {
        if (!selectedFile || !selectedPlatform || !brandSlug) return;

        setIsWorking(true);
        setProgress(0);
        setProgressText('Đang tải tệp lên...');
        
        intervalRef.current = setInterval(() => {
            setProgress(prev => {
                const next = prev + 5;
                if (next >= 90) {
                    clearInterval(intervalRef.current);
                    return 90;
                }
                return next;
            });
        }, 150);

        try {
            await uploadStandardFile(selectedPlatform, brandSlug, selectedFile);
            
            if (intervalRef.current) clearInterval(intervalRef.current);
            setProgress(90);
            setProgressText('Máy chủ đang xử lý dữ liệu...');
            
            intervalRef.current = setInterval(() => {
                setProgress(prev => Math.min(prev + 1, 99));
            }, 1000);

            await onUploadComplete();

            clearInterval(intervalRef.current);
            setProgress(100);
            setProgressText('Hoàn thành!');
            
            setTimeout(() => onClose(), 500);

        } catch (error) {
            showNotification(error.message || 'Lỗi khi upload hoặc xử lý file.', 'error');
            setIsWorking(false);
            setProgress(0);
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        }
    };
    
    return (
        <Dialog open={open} onClose={() => !isWorking && onClose()} maxWidth="sm" fullWidth>
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
                        <Select value={selectedPlatform} label="Chọn Sàn Hoặc Thêm Mới" onChange={(e) => setSelectedPlatform(e.target.value)}>
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
                <Button onClick={handleUpload} variant="contained" disabled={!selectedFile || !selectedPlatform || isWorking}>
                    {isWorking ? 'Đang xử lý...' : 'Bắt đầu Import'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SingleImportDialog;
