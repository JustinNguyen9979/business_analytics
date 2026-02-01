import React from 'react';
import { 
    Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Paper, Box
} from '@mui/material';

// Components
import OrderRow from './OrderRow';
import { StyledTableHeader } from '../StyledComponents.jsx';

const OrderHistoryTable = ({ orders, data, maxHeight = 500 }) => {
    return (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: maxHeight, bgcolor: 'background.paper' }}>
            <Table stickyHeader size="small" sx={{ 
                tableLayout: 'fixed', // Quan trọng: Cố định layout để không bị nhảy khi mở rộng row
                '& .MuiTableCell-root': { borderBottom: 'none' }
            }}>
                <TableHead>
                    <StyledTableHeader>
                        <TableCell sx={{ width: '45px' }}></TableCell>
                        <TableCell sx={{ width: '170px' }}>Mã Đơn Hàng</TableCell>
                        <TableCell sx={{ width: '180px' }}>Mã Vận Đơn</TableCell>
                        <TableCell sx={{ width: '95px' }}>Ngày Đặt</TableCell>
                        <TableCell sx={{ width: '90px' }}>Giờ Đặt</TableCell>
                        <TableCell sx={{ width: '140px' }}>Trạng Thái</TableCell>
                        <TableCell align="right" sx={{ width: '120px' }}>Doanh Thu</TableCell>
                        <TableCell sx={{ width: '150px' }}>Lý Do</TableCell>
                    </StyledTableHeader>
                </TableHead>
                <TableBody>
                    {orders && orders.length > 0 ? (
                        orders.map((order) => (
                            <OrderRow key={order.order_code || order.id} order={order} data={data} />
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={8} align="center" sx={{ py: 3, color: 'text.secondary', fontStyle: 'italic' }}>
                                Chưa có dữ liệu đơn hàng
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default OrderHistoryTable;