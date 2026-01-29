import React from 'react';
import { 
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
    Typography, useTheme
} from '@mui/material';
import { formatCurrency, formatNumber } from '../../utils/formatters';

const OrderItemsTable = ({ items = [] }) => {
    const theme = useTheme();

    if (!items || items.length === 0) {
        return (
            <Typography variant="body2" fontStyle="italic" color="text.secondary">
                Không có dữ liệu sản phẩm chi tiết
            </Typography>
        );
    }

    return (
        <TableContainer sx={{ borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: 'background.paper' }}>
            <Table size="small">
                <TableHead>
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ fontWeight: 'bold' }}>SKU</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Tên Sản Phẩm</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Giá Gốc</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Số Lượng</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Trợ Giá</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Thành tiền</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {items.map((item, index) => {
                        // Handle naming differences between API responses (search vs list)
                        const sku = item.sku;
                        const name = item.product_name || item.name || '---';
                        const price = item.original_price || item.price || 0;
                        const qty = item.quantity || item.qty || 0;
                        const subsidy = item.subsidy_amount || 0;
                        // Determine total: prefer pre-calculated, else calculate
                        const total = item.total || ((price * qty) - subsidy);

                        return (
                            <TableRow key={index} hover>
                                <TableCell sx={{ fontFamily: 'monospace', color: 'primary.light' }}>{sku}</TableCell>
                                <TableCell>
                                    <Typography variant="body2">{name}</Typography>
                                </TableCell>
                                <TableCell align="right">{formatNumber(price)}</TableCell>
                                <TableCell align="right">{qty}</TableCell>
                                <TableCell align="right">{formatNumber(subsidy)}</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                                    {formatNumber(total)}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default OrderItemsTable;
