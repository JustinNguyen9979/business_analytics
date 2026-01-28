import React from 'react';
import { 
    Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Paper, Box
} from '@mui/material';

// Components
import OrderRow from './OrderRow';

const OrderHistoryTable = ({ orders, maxHeight = 500 }) => {
    return (
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: maxHeight, bgcolor: 'background.paper' }}>
            <Table stickyHeader size="small">
                <TableHead>
                    <TableRow>
                        <TableCell></TableCell>
                        <TableCell>Mã Đơn Hàng</TableCell>
                        <TableCell>Mã Vận Đơn</TableCell>
                        <TableCell>Ngày Đặt</TableCell>
                        <TableCell>Giờ Đặt</TableCell>
                        <TableCell>Trạng Thái</TableCell>
                        <TableCell align="right">Doanh Thu</TableCell>
                        <TableCell>Lý Do</TableCell>
                        <TableCell>Nguồn</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {orders && orders.length > 0 ? (
                        orders.map((order) => (
                            <OrderRow key={order.order_code || order.id} order={order} />
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