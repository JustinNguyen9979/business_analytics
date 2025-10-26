// FILE: frontend/src/components/CreateBrandCard.jsx
import React, { useState } from 'react';
import { Card, Dialog, DialogTitle, DialogContent, TextField, Button, DialogActions, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

function CreateBrandCard({ onBrandCreated }) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');
    const [createError, setCreateError] = useState(''); 

    const handleClickOpen = () => {
        setCreateError(''); 
        if(onClearError) onClearError(); 
        setOpen(true);
    };
    
    const handleClose = () => {
        setOpen(false);
        setName('');
    };

    const handleCreate = async () => {
        try {
            await onCreate(name.trim());
            handleClose();
        } catch (err) {
            // Lấy lỗi từ component cha và set vào state lỗi cục bộ
            const errorMessage = err.response?.data?.detail || 'Lỗi không xác định.';
            setCreateError(errorMessage);
            if (onError) onError(errorMessage);
        }
    };

    return (
        <>
            <Card
                onClick={handleClickOpen}
                sx={{
                    width: 200,
                    height: 200,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    // Hiệu ứng Kính mờ
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(10px)',
                    border: '2px dashed rgba(255, 255, 255, 0.2)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderColor: 'rgba(0, 191, 255, 0.8)', // Màu primary
                    },
                }}
            >
                <AddIcon sx={{ fontSize: 60, color: 'rgba(255, 255, 255, 0.4)' }} />
            </Card>

            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="xs"
                fullWidth
                // Tùy chỉnh lớp nền mờ phía sau Dialog
                BackdropProps={{
                    sx: {
                        backdropFilter: 'blur(3px)',
                    }
                }}
                // Tùy chỉnh chính Dialog
                PaperProps={{
                    sx: {
                        borderRadius: 4, // Bo tròn góc
                        // Hiệu ứng Kính mờ
                        backgroundColor: 'rgba(30, 41, 59, 0.7)', // Màu xám xanh đậm trong suốt
                        backdropFilter: 'blur(15px)', // Độ mờ cao hơn
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
                    }
                }}
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>Tạo Brand Mới</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Tên Brand"
                        type="text"
                        fullWidth
                        variant="outlined" // Đổi thành outlined cho đẹp hơn
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                        error={!!createError}
                        helperText={createError}
                    />
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 16px' }}>
                    <Button onClick={handleClose} color="secondary">Hủy</Button>
                    <Button onClick={handleCreate} variant="contained">Tạo</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default CreateBrandCard;