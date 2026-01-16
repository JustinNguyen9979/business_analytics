import React, { useState } from 'react';
import { 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Paper, Chip, Typography, Box, Avatar, IconButton, Tooltip, Pagination, Stack 
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DoNotDisturbOnIcon from '@mui/icons-material/DoNotDisturbOn';
import { formatCurrency } from '../../utils/formatters';

const getRiskInfo = (row) => {
    const total = row.total_orders || 0;
    const bomb = row.bomb_orders || 0;
    const cancel = row.cancelled_orders || 0;
    
    // Logic đánh giá rủi ro
    if (bomb > 0) return { label: 'Nguy hiểm (Bom)', color: 'error', icon: <DoNotDisturbOnIcon fontSize="small" /> };
    
    const cancelRate = total > 0 ? (cancel / total) : 0;
    if (cancelRate > 0.3 && total >= 3) return { label: 'Cần chú ý (Hủy nhiều)', color: 'warning', icon: <WarningAmberIcon fontSize="small" /> };
    
    return { label: 'Uy tín', color: 'success', icon: <CheckCircleIcon fontSize="small" /> };
};

const CustomerTable = ({ data }) => {
    const [page, setPage] = useState(1); // Pagination dùng index bắt đầu từ 1
    const rowsPerPage = 10; 

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    // Cắt dữ liệu theo trang (chuyển về 0-based index để slice)
    const visibleRows = data.slice((page - 1) * rowsPerPage, (page - 1) * rowsPerPage + rowsPerPage);

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <TableContainer 
                component={Box} 
                sx={{ 
                    flex: 1,
                    minHeight: 0, 
                    bgcolor: 'transparent', 
                    overflow: 'auto',
                    '&::-webkit-scrollbar': { width: '6px' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: '10px' },
                    '&::-webkit-scrollbar-thumb:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
                }}
            >
                <Table stickyHeader sx={{ minWidth: 650 }} aria-label="customer table">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Khách hàng</TableCell>
                            <TableCell sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Khu vực</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Tổng đơn</TableCell>
                            <TableCell align="center" sx={{ color: '#4caf50', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Thành công</TableCell>
                            <TableCell align="center" sx={{ color: '#ff9800', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Hủy</TableCell>
                            <TableCell align="center" sx={{ color: '#f44336', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Bom/Hoàn</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Tổng chi tiêu</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>TB/Đơn (AOV)</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Đánh giá</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {visibleRows.map((row, index) => {
                            const risk = getRiskInfo(row);
                            const displayName = row.username || 'Khách vãng lai';
                            const location = row.city || row.district || '---';
                            const aov = row.completed_orders > 0 ? (row.total_spent / row.completed_orders) : 0;
                            const bombAndRefund = (row.bomb_orders || 0) + (row.refunded_orders || 0);

                            return (
                                <TableRow
                                    key={index}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
                                >
                                    <TableCell component="th" scope="row">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar sx={{ bgcolor: stringToColor(displayName), width: 32, height: 32, fontSize: '0.875rem', fontWeight: 'bold' }}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="body2" fontWeight="600">{displayName}</Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="caption" color="text.secondary">{location}</Typography>
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.total_orders}</TableCell>
                                    <TableCell align="center" sx={{ color: '#66bb6a', fontWeight: 'bold' }}>{row.completed_orders}</TableCell>
                                    <TableCell align="center" sx={{ color: '#ffa726' }}>{row.cancelled_orders}</TableCell>
                                    <TableCell align="center" sx={{ color: '#ef5350', fontWeight: 'bold' }}>
                                        {bombAndRefund > 0 ? bombAndRefund : '-'}
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                        {formatCurrency(row.total_spent)}
                                    </TableCell>
                                    <TableCell align="right">
                                        {formatCurrency(aov)}
                                    </TableCell>
                                    <TableCell align="center">
                                        <Chip 
                                            icon={risk.icon}
                                            label={risk.label} 
                                            color={risk.color} 
                                            size="small" 
                                            variant="outlined"
                                            sx={{ minWidth: 100 }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Xem chi tiết">
                                            <IconButton size="small">
                                                <VisibilityIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            
            {/* PHẦN PHÂN TRANG (PAGINATION) - Đánh số 1, 2, 3... */}
            <Box sx={{ 
                flexShrink: 0, 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                bgcolor: 'rgba(0, 0, 0, 0.2)', 
                p: 2,
                display: 'flex',
                justifyContent: 'center' // Căn giữa
            }}>
                <Pagination 
                    count={Math.ceil(data.length / rowsPerPage)} 
                    page={page} 
                    onChange={handleChangePage} 
                    color="primary" 
                    shape="rounded"
                    showFirstButton 
                    showLastButton
                />
            </Box>
        </Box>
    );
};

// Helper tạo màu ngẫu nhiên từ tên
function stringToColor(string) {
    if (!string) return '#757575'; // Màu xám mặc định nếu string rỗng
    let hash = 0;
    let i;
    for (i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
}

export default CustomerTable;
