// FILE: frontend/src/components/CreateBrandCard.jsx
import React from 'react';
import { Card, IconButton, Dialog, DialogTitle, DialogContent, TextField, Button, DialogActions, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

function CreateBrandCard({ onBrandCreated }) {
    const [open, setOpen] = React.useState(false);
    const [name, setName] = React.useState('');

    const handleClickOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const handleCreate = () => {
        onBrandCreated(name);
        handleClose();
        setName('');
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

            <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { borderRadius: 4, backgroundColor: 'rgba(10, 25, 41, 0.9)', backdropFilter: 'blur(5px)' } }}>
                <DialogTitle>Tạo Brand Mới</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Tên Brand"
                        type="text"
                        fullWidth
                        variant="outlined"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreate()}
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