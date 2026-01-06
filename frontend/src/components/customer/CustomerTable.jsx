import React from 'react';
import { 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Paper, Chip, Typography, Box, Avatar, IconButton, Tooltip 
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { formatCurrency } from '../../utils/formatters';

const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
        case 'high': return 'error';     // Đỏ - Hay bom
        case 'medium': return 'warning'; // Vàng - Hay hủy
        default: return 'success';       // Xanh - Uy tín
    }
};

const getRiskLabel = (riskLevel) => {
    switch (riskLevel) {
        case 'high': return 'Nguy cơ cao (Bom)';
        case 'medium': return 'Cần chú ý (Hủy nhiều)';
        default: return 'Uy tín';
    }
};

const CustomerTable = ({ data }) => {
    return (
        <TableContainer component={Paper} sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 'none', border: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Table sx={{ minWidth: 650 }} aria-label="customer table">
                <TableHead>
                    <TableRow>
                        <TableCell>Khách hàng</TableCell>
                        <TableCell>Số điện thoại</TableCell>
                        <TableCell align="center">Tổng đơn</TableCell>
                        <TableCell align="right">Tổng chi tiêu</TableCell>
                        <TableCell align="right">Trung bình/Đơn</TableCell>
                        <TableCell align="center">Rủi ro</TableCell>
                        <TableCell align="center">Hành động</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {data.map((row, index) => (
                        <TableRow
                            key={index}
                            sx={{ '&:last-child td, &:last-child th': { border: 0 }, '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' } }}
                        >
                            <TableCell component="th" scope="row">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Avatar sx={{ bgcolor: stringToColor(row.name), width: 32, height: 32, fontSize: '0.875rem' }}>
                                        {row.name.charAt(0)}
                                    </Avatar>
                                    <Typography variant="body2" fontWeight="500">{row.name}</Typography>
                                </Box>
                            </TableCell>
                            <TableCell>{row.phone}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 'bold' }}>{row.total_orders}</TableCell>
                            <TableCell align="right" sx={{ color: '#4caf50', fontWeight: 'bold' }}>
                                {formatCurrency(row.total_spent)}
                            </TableCell>
                            <TableCell align="right">
                                {formatCurrency(row.avg_order_value)}
                            </TableCell>
                            <TableCell align="center">
                                <Chip 
                                    icon={row.risk === 'high' ? <WarningAmberIcon /> : null}
                                    label={getRiskLabel(row.risk)} 
                                    color={getRiskColor(row.risk)} 
                                    size="small" 
                                    variant="outlined"
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
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

// Helper tạo màu ngẫu nhiên từ tên (để Avatar đỡ nhàm chán)
function stringToColor(string) {
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
