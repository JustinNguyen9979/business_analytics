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
import ReportIcon from '@mui/icons-material/Report';
import { formatCurrency } from '../../utils/formatters';
import CustomerDetailDialog from './CustomerDetailDialog'; // Import Dialog

const getRiskInfo = (row) => {
    const total = row.total_orders || 0;
    const bomb = row.bomb_orders || 0;
    const cancel = row.cancelled_orders || 0;
    const refund = row.refunded_orders || 0;
    
    // Logic đánh giá rủi ro (Giống CustomerDetailDialog)
    if (refund > 0) {
        return { 
            label: 'Báo động (Hoàn)', 
            bg: 'rgba(255, 82, 82, 0.1)', 
            color: '#FF5252', 
            icon: <ReportIcon fontSize="small" style={{ color: '#FF5252' }} /> 
        };
    }

    if (bomb > 0) {
        return { 
            label: 'Cảnh báo (Bom)', 
            bg: 'rgba(255, 152, 0, 0.1)', 
            color: '#FF9800', 
            icon: <DoNotDisturbOnIcon fontSize="small" style={{ color: '#FF9800' }} /> 
        };
    }
    
    const cancelRate = total > 0 ? (cancel / total) : 0;
    if (total > 3 && cancelRate > 0.4) {
        return { 
            label: 'Hủy nhiều', 
            bg: 'rgba(255, 193, 7, 0.1)', 
            color: '#FFC107', 
            icon: <WarningAmberIcon fontSize="small" style={{ color: '#FFC107' }} /> 
        };
    }
    
    return { 
        label: 'Uy tín', 
        bg: 'rgba(76, 175, 80, 0.1)', 
        color: '#4CAF50', 
        icon: <CheckCircleIcon fontSize="small" style={{ color: '#4CAF50' }} /> 
    };
};

const CustomerTable = ({ data }) => {
    // State cho Dialog chi tiết
    const [selectedUser, setSelectedUser] = useState(null);

    // Xác định cấu trúc dữ liệu: Array cũ hay Object mới (Server Pagination)
    const isNewStructure = data && data.pagination;
    
    // Lấy list khách hàng
    const rows = isNewStructure ? data.data : data;
    
    // Pagination Props
    // Server-side dùng 1-based index cho Page, nhưng TablePagination dùng 0-based
    const page = isNewStructure ? data.pagination.page : 1;
    const totalCount = isNewStructure ? data.pagination.totalCount : rows.length;
    const rowsPerPage = isNewStructure ? data.pagination.rowsPerPage : 10;
    const handleChangePage = isNewStructure ? data.pagination.handleChangePage : () => {};

    // Client-side pagination fallback (cho trường hợp legacy array)
    const [clientPage, setClientPage] = useState(1);
    const clientRowsPerPage = 10;
    
    // Nếu là Server-side, rows đã được cắt sẵn. Nếu Client-side, cần cắt.
    const finalRows = isNewStructure 
        ? rows 
        : rows.slice((clientPage - 1) * clientRowsPerPage, (clientPage - 1) * clientRowsPerPage + clientRowsPerPage);
        
    const handlePageChange = (event, newPage) => {
        if (isNewStructure) {
            // Convert 0-based to 1-based for Server
            handleChangePage(event, newPage);
        } else {
            setClientPage(newPage);
        }
    };

    const currentPage = isNewStructure ? page : clientPage;
    const count = isNewStructure
        ? Math.ceil(totalCount / rowsPerPage)
        : Math.ceil(rows.length / clientRowsPerPage);

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
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Đơn (Kỳ)</TableCell>
                            <TableCell align="center" sx={{ color: '#4caf50', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Thành công</TableCell>
                            <TableCell align="center" sx={{ color: '#ff9800', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Hủy</TableCell>
                            <TableCell align="center" sx={{ color: '#f44336', bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Bom/Hoàn</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Chi tiêu (Kỳ)</TableCell>
                            <TableCell align="right" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>TB/Đơn (AOV)</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>Đánh giá</TableCell>
                            <TableCell align="center" sx={{ bgcolor: 'background.paper', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {finalRows.map((row, index) => {
                            const risk = getRiskInfo(row);
                            const displayName = row.username || 'Khách vãng lai';
                            
                            // Kết hợp Quận/Huyện và Tỉnh/Thành để hiển thị chi tiết
                            const locationParts = [];
                            if (row.district && row.district !== '---') locationParts.push(row.district);
                            if (row.province && row.province !== '---') locationParts.push(row.province);
                            const location = locationParts.length > 0 ? locationParts.join(' - ') : '---';

                            const aov = row.completed_orders > 0 ? (row.total_spent / row.completed_orders) : 0;
                            const bombAndRefund = (row.bomb_orders || 0) + (row.refunded_orders || 0);

                            return (
                                <TableRow
                                    key={index}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
                                >
                                    <TableCell component="th" scope="row">
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar sx={{ bgcolor: stringToColor(displayName), width: 28, height: 28, fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                {displayName.charAt(0).toUpperCase()}
                                            </Avatar>
                                            <Typography variant="body2" fontWeight="600">{displayName}</Typography>
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
                                            size="small" 
                                            variant="outlined"
                                            sx={{ 
                                                minWidth: 100,
                                                borderColor: risk.color,
                                                color: risk.color,
                                                bgcolor: risk.bg,
                                                fontWeight: 'bold',
                                                '& .MuiChip-icon': { color: 'inherit' }
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell align="center">
                                        <Tooltip title="Xem chi tiết">
                                            <IconButton size="small" onClick={() => setSelectedUser(row.username)}>
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
            
            {/* PHẦN PHÂN TRANG (PAGINATION) */}
            <Box sx={{ 
                flexShrink: 0, 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
                bgcolor: 'rgba(0, 0, 0, 0.2)', 
                p: 2,
                display: 'flex',
                justifyContent: 'center'
            }}>
                <Pagination
                    count={count}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    shape="rounded"
                    showFirstButton
                    showLastButton
                />
            </Box>

            {/* DIALOG CHI TIẾT KHÁCH HÀNG */}
            <CustomerDetailDialog 
                open={!!selectedUser} 
                username={selectedUser} 
                onClose={() => setSelectedUser(null)} 
            />
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
