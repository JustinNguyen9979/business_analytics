import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Typography,
    Skeleton,
    Alert
} from '@mui/material';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

// Danh sách các cột và cách định dạng chúng
const columns = [
    { id: 'platform', label: 'Nền tảng', minWidth: 170, align: 'left', format: (value) => value },
    { id: 'gmv', label: 'GMV', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'netRevenue', label: 'Doanh thu thuần', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'profit', label: 'Lợi nhuận', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'cogs', label: 'Giá vốn (COGS)', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'executionCost', label: 'Phí vận hành', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'adSpend', label: 'Chi phí Ads', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'totalCost', label: 'Tổng chi phí', minWidth: 120, align: 'right', format: (value) => formatCurrency(value) },
    { id: 'profitMargin', label: 'Tỷ suất lợi nhuận', minWidth: 100, align: 'right', format: (value) => formatPercentage(value) },
    { id: 'roi', label: 'ROI', minWidth: 100, align: 'right', format: (value) => formatPercentage(value) },
    { id: 'takeRate', label: 'Take Rate', minWidth: 100, align: 'right', format: (value) => formatPercentage(value) },
];

// Component Skeleton để hiển thị khi đang tải dữ liệu
const TableSkeleton = () => (
    <>
        {[...Array(4)].map((_, rowIndex) => (
            <TableRow key={rowIndex}>
                {columns.map((column) => (
                    <TableCell key={column.id} align={column.align}>
                        <Skeleton variant="text" />
                    </TableCell>
                ))}
            </TableRow>
        ))}
    </>
);


const FinanceTable = ({ data, loading, error }) => {
    if (error) {
        return <Alert severity="error">Lỗi tải dữ liệu: {error}</Alert>;
    }

    const tableData = data || [];

    return (
        <Paper variant="glass" sx={{ width: '100%', overflow: 'hidden', p: 2 }}>
            <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader aria-label="sticky table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    align={column.align}
                                    sx={{ 
                                        minWidth: column.minWidth, 
                                        fontWeight: 'bold',
                                        backgroundColor: 'transparent' // Cho header trong suốt
                                    }}
                                >
                                    {column.label}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton />
                        ) : tableData.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={columns.length} align="center">
                                    <Typography color="text.secondary" sx={{ p: 4 }}>
                                        Không có dữ liệu để hiển thị.
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            tableData.map((row, index) => {
                                const isTotalRow = row.platform === 'Tổng cộng';
                                return (
                                    <TableRow 
                                        hover 
                                        role="checkbox" 
                                        tabIndex={-1} 
                                        key={row.platform + index}
                                        sx={{
                                            // Làm nổi bật hàng Tổng cộng
                                            backgroundColor: isTotalRow ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        }}
                                    >
                                        {columns.map((column) => {
                                            const value = row[column.id];
                                            return (
                                                <TableCell 
                                                    key={column.id} 
                                                    align={column.align}
                                                    sx={{
                                                        fontWeight: isTotalRow ? 'bold' : 'normal',
                                                    }}
                                                >
                                                    {column.format(value)}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default FinanceTable;
