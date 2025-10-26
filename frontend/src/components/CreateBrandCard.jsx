// FILE: frontend/src/components/CreateBrandCard.jsx (PHIÊN BẢN CUỐI CÙNG)

import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, TextField, Button, DialogActions } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
// 1. IMPORT STYLED COMPONENT MỚI
import { StyledAddCard } from './StyledComponents';

function CreateBrandCard({ onCreate }) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState('');
    const [createError, setCreateError] = useState(''); 

    const handleClickOpen = () => {
        setCreateError('');
        setName('');
        setOpen(true);
    };
    
    const handleClose = () => {
        setOpen(false);
    };

    const handleCreate = async () => {
        if (!name.trim()) {
            setCreateError('Tên thương hiệu không được để trống.');
            return;
        }
        try {
            await onCreate(name.trim());
            handleClose();
        } catch (err) {
            const errorMessage = err.response?.data?.detail || 'Lỗi không xác định.';
            setCreateError(errorMessage);
        }
    };

    return (
        <>
            {/* 2. SỬ DỤNG STYLEDADD CARD THAY THẾ */}
            <StyledAddCard onClick={handleClickOpen}>
                <AddIcon sx={{ fontSize: 60, color: 'rgba(255, 255, 255, 0.4)' }} />
            </StyledAddCard>

            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="xs"
                fullWidth
                BackdropProps={{ sx: { backdropFilter: 'blur(5px)' } }}
            >
                <DialogTitle sx={{ fontWeight: 'bold' }}>Thêm Thương hiệu Mới</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Tên Thương hiệu"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value);
                            if (createError) setCreateError('');
                        }}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
                        error={!!createError}
                        helperText={createError}
                    />
                </DialogContent>
                <DialogActions sx={{ p: '0 24px 16px' }}>
                    <Button onClick={handleClose} color="secondary">Hủy</Button>
                    <Button onClick={handleCreate} variant="contained">Thêm mới</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

export default CreateBrandCard;