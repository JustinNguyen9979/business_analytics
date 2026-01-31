import React, { useState, useEffect } from 'react';
import { 
    Box, Typography, Stack, Divider, Avatar, 
    Paper, Chip, LinearProgress, IconButton, 
    TextField, Button, CircularProgress,
    MenuItem, Select, FormControl, InputLabel,
    Tooltip
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useParams } from 'react-router-dom';

// Icons
import LocalPhoneIcon from '@mui/icons-material/LocalPhone';
import EmailIcon from '@mui/icons-material/Email';
import PlaceIcon from '@mui/icons-material/Place';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WcIcon from '@mui/icons-material/Wc';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';

// Custom Components
import { LuxuryCard, CardContent } from '../StyledComponents';
import { LabelValue, SectionTitle } from '../search/SearchCommon';
import { updateCustomerAPI } from '../../services/api';

const CustomerProfileCard = ({ data: initialData, sx = {} }) => {
    const theme = useTheme();
    const { brandIdentifier } = useParams(); 
    
    // State quản lý dữ liệu
    const [data, setData] = useState(initialData);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // State cho form edit
    const [formData, setFormData] = useState({
        phone: '',
        email: '',
        gender: '',
        default_address: '',
        notes: ''
    });

    // Cập nhật local state khi props thay đổi
    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    const handleStartEdit = () => {
        if (!data) return;
        setFormData({
            phone: data.phone === '---' ? '' : data.phone,
            email: data.email === '---' ? '' : data.email,
            gender: (!data.gender || data.gender === '---') ? '' : data.gender,
            default_address: data.defaultAddress === '---' ? '' : data.defaultAddress,
            notes: data.notes === '---' ? '' : data.notes
        });
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updatedCustomer = await updateCustomerAPI(brandIdentifier, data.id, formData);
            setData(updatedCustomer);
            setIsEditing(false);
        } catch (error) {
            console.error("Failed to update customer:", error);
            alert("Có lỗi xảy ra khi cập nhật thông tin!");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInputChange = (field) => (event) => {
        setFormData({ ...formData, [field]: event.target.value });
    };

    // Helper Styles cho Rank
    const getRankStyles = (rank) => {
        const r = rank?.toUpperCase() || 'MEMBER';
        switch(r) {
            case 'DIAMOND': return { background: 'linear-gradient(45deg, #D500F9 30%, #00E5FF 90%)', boxShadow: '0 0 15px rgba(213, 0, 249, 0.6)', color: '#fff', glow: '#D500F9' };
            case 'PLATINUM': return { background: 'linear-gradient(45deg, #2979FF 30%, #00E5FF 90%)', boxShadow: '0 0 12px rgba(41, 121, 255, 0.5)', color: '#fff', glow: '#2979FF' };
            case 'GOLD': return { background: 'linear-gradient(45deg, #FFAB00 30%, #FFEA00 90%)', boxShadow: '0 0 10px rgba(255, 234, 0, 0.5)', color: '#000', glow: '#FFEA00' };
            case 'SILVER': return { bgcolor: 'rgba(144, 164, 174, 0.2)', border: '1px solid #90A4AE', color: '#90A4AE', glow: '#90A4AE' };
            default: return { bgcolor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.2)', color: 'rgba(255, 255, 255, 0.6)', glow: 'rgba(255, 255, 255, 0.2)' };
        }
    };

    if (!data) return null;
        const rankStyle = getRankStyles(data.rank);
    
        return (
            <LuxuryCard sx={{ ...sx, position: 'relative' }}> 
                {/* Header Background */}
                <Box sx={{                  height: 120, 
                background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`, 
                opacity: 0.3,
                maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                borderTopLeftRadius: '16px', borderTopRightRadius: '16px' // Bo góc khớp với Card
            }} />

            {/* Edit Controls */}
            <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}>
                {isEditing ? (
                    <Stack direction="row" spacing={1}>
                        <Button variant="outlined" color="error" size="small" startIcon={<CancelIcon />} onClick={handleCancelEdit} disabled={isSaving} sx={{ bgcolor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>Hủy</Button>
                        <Button variant="contained" color="success" size="small" startIcon={isSaving ? <CircularProgress size={20} color="inherit"/> : <SaveIcon />} onClick={handleSave} disabled={isSaving}>Lưu</Button>
                    </Stack>
                ) : (
                    <IconButton onClick={handleStartEdit} sx={{ bgcolor: 'rgba(0,0,0,0.4)', color: 'primary.main', backdropFilter: 'blur(4px)', border: `1px solid ${theme.palette.primary.main}`, '&:hover': { bgcolor: 'primary.main', color: 'black' } }}>
                        <EditIcon />
                    </IconButton>
                )}
            </Box>
            
            {/* Avatar & Main Info */}
            <Box sx={{ px: 3, pb: 4, mt: -6, textAlign: 'center', position: 'relative' }}>
                <Avatar sx={{ 
                    width: 100, height: 100, mx: 'auto', 
                    border: `4px solid ${theme.palette.background.paper}`, 
                    bgcolor: 'background.default', color: rankStyle.glow,
                    boxShadow: `0 0 30px ${rankStyle.glow}`, fontWeight: 900, fontSize: '2.5rem',
                    transition: 'all 0.5s ease'
                }}>
                    {(data.name || '?').charAt(0).toUpperCase()}
                </Avatar>
                
                {/* Tên khách hàng - Hiệu ứng Marquee khi tên quá dài */}
                <Box className="marquee-box" sx={{ mt: 2, mb: 1, mx: 'auto', maxWidth: '90%' }}>
                    <Typography 
                        variant="h5" 
                        className="marquee-text"
                        sx={{ 
                            animation: (data.name?.length > 15) ? 'marquee 8s linear infinite' : 'none'
                        }}
                    >
                        {data.name || '---'}
                    </Typography>
                </Box>
                
                <Stack direction="row" spacing={1} justifyContent="center">
                    <Chip label={data.rank} size="small" sx={{ fontWeight: 'bold', ...rankStyle, borderRadius: '6px' }} />
                    <Chip label={`ID: ${data.id}`} variant="outlined" size="small" sx={{ borderColor: 'divider', color: 'text.secondary' }} />
                </Stack>
                
                {/* Rank Progress */}
                <Box sx={{ mt: 3, textAlign: 'left' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">Tiến độ lên <Box component="span" sx={{ color: 'secondary.main', fontWeight: 'bold' }}>{data.nextRank}</Box></Typography>
                        <Typography variant="caption" fontWeight="bold" color="primary.main">{data.rankProgress || 0}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={data.rankProgress || 0} sx={{ height: 6, borderRadius: 3, bgcolor: 'action.disabledBackground', '& .MuiLinearProgress-bar': { borderRadius: 3, background: `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`, boxShadow: `0 0 10px ${theme.palette.primary.main}` } }} />
                </Box>
            </Box>
            
            <Divider sx={{ borderColor: 'divider' }} />
            
            <CardContent>
                <SectionTitle>THÔNG TIN LIÊN HỆ</SectionTitle>
                <Stack spacing={2} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box sx={{ flex: 1 }}>
                            {isEditing ? (
                                <TextField label="Số điện thoại" value={formData.phone} onChange={handleInputChange('phone')} fullWidth size="small" variant="outlined" InputProps={{ startAdornment: <LocalPhoneIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }} />
                            ) : (
                                <LabelValue icon={<LocalPhoneIcon />} label="Số điện thoại" value={data.phone} isLink />
                            )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            {isEditing ? (
                                <FormControl fullWidth size="small">
                                    <InputLabel>Giới tính</InputLabel>
                                        <Select
                                            value={formData.gender}
                                            label="Giới tính"
                                            onChange={handleInputChange('gender')}
                                            startAdornment={<WcIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} />}
                                            MenuProps={{
                                                PaperProps: { variant: 'liquidGlass' }
                                            }}                                    
                                        >
                                        <MenuItem value="Nam">Nam</MenuItem>
                                        <MenuItem value="Nữ">Nữ</MenuItem>
                                        <MenuItem value="Khác">Khác</MenuItem>
                                        <MenuItem value="">---</MenuItem>
                                        </Select>
                                        </FormControl>
                                        ) : (         
                                <LabelValue icon={<WcIcon />} label="Giới tính" value={data.gender} />
                            )}
                        </Box>
                    </Box>
                    
                    {isEditing ? (
                        <>
                            <TextField label="Email" value={formData.email} onChange={handleInputChange('email')} fullWidth size="small" variant="outlined" InputProps={{ startAdornment: <EmailIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }} />
                            <TextField label="Địa chỉ mặc định" value={formData.default_address} onChange={handleInputChange('default_address')} fullWidth size="small" variant="outlined" multiline maxRows={3} InputProps={{ startAdornment: <PlaceIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }} />
                        </>
                    ) : (
                        <>
                            <LabelValue icon={<EmailIcon />} label="Email" value={data.email} />
                            <LabelValue icon={<PlaceIcon />} label="Địa chỉ mặc định" value={data.defaultAddress} />
                        </>
                    )}
                </Stack>
                
                <SectionTitle>PHÂN TÍCH ĐƠN HÀNG</SectionTitle>
                <Box sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', mb: 2, bgcolor: 'action.hover', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.5)' }}>
                        {(() => {
                            const total = data.orderCount || 1; 
                            const pSuccess = (data.successCount / total) * 100;
                            const pRefund = (data.refundedOrders / total) * 100;
                            const pBomb = (data.bombOrders / total) * 100;
                            const cancelCount = Math.max(0, data.orderCount - (data.successCount + data.refundedOrders + data.bombOrders));
                            const pCancel = (cancelCount / total) * 100;
                            return (
                                <>
                                    <Box sx={{ width: `${pSuccess}%`, bgcolor: 'success.main', boxShadow: '0 0 10px #00E676' }} />
                                    <Box sx={{ width: `${pRefund}%`, bgcolor: 'error.main', boxShadow: '0 0 10px #FF1744' }} />
                                    <Box sx={{ width: `${pBomb}%`, bgcolor: 'warning.main', boxShadow: '0 0 10px #FFEA00' }} />
                                    <Box sx={{ width: `${pCancel}%`, bgcolor: 'text.disabled' }} />
                                </>
                            );
                        })()}
                    </Box>

                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                        {[
                            { label: 'Thành công', val: data.successCount, color: 'success.main' },
                            { label: 'Hoàn tiền', val: data.refundedOrders, color: 'error.main' },
                            { label: 'Bom hàng', val: data.bombOrders, color: 'warning.main' },
                            { label: 'Đã hủy', val: data.cancelCount, color: 'text.disabled' }
                        ].map((item, idx) => (
                            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color, boxShadow: `0 0 5px ${item.color}` }} />
                                    <Typography variant="body2" color="text.secondary" fontSize="0.8rem">{item.label}</Typography>
                                </Box>
                                <Typography variant="body2" fontWeight="bold" color="text.primary">{item.val}</Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
                
                <SectionTitle>GHI CHÚ (NỘI BỘ)</SectionTitle>
                <Paper sx={{ p: 2, bgcolor: 'action.hover', border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                    {isEditing ? (
                        <TextField placeholder="Nhập ghi chú..." value={formData.notes} onChange={handleInputChange('notes')} fullWidth size="small" variant="standard" multiline InputProps={{ disableUnderline: true }} sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem', fontStyle: 'italic' } }} />
                    ) : (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <AssignmentIcon sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0, mt: '2px' }} />
                            <Tooltip title={(!data.notes || data.notes === "---" ) ? "Chưa có ghi chú..." : data.notes} arrow placement="top">
                                <Typography 
                                    variant="body2" 
                                    color="text.secondary" 
                                    sx={{ 
                                        fontStyle: 'italic',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        wordBreak: 'break-word',
                                        cursor: 'default',
                                        userSelect: 'none'
                                    }}
                                >
                                    {(!data.notes || data.notes === "---") ? "Chưa có ghi chú..." : data.notes}
                                </Typography>
                            </Tooltip>
                        </Box>
                    )}
                    {data.tags && data.tags.length > 0 && (
                        <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
                            {data.tags.map(tag => (
                                <Chip key={tag} label={tag} size="small" variant="outlined" color="secondary" sx={{ borderStyle: 'dashed' }} />
                            ))}
                        </Stack>
                    )}
                </Paper>
            </CardContent>
        </LuxuryCard>
    );
};

export default CustomerProfileCard;