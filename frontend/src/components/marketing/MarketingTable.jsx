import React, { useState } from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography,
    Skeleton,
    Alert,
    TablePagination,
} from '@mui/material';
import { formatCurrency, formatNumber, formatPercentage } from '../../utils/formatters';

const formatRatio = (value) => {
    if (typeof value !== 'number' || !isFinite(value)) return '0.00';
    return value.toFixed(2);
};

const columns = [
    { id: 'platform', label: 'Nền tảng', minWidth: 140, align: 'left', format: (value) => value || '---' },
    { id: 'ad_spend', label: 'Ads Spend', minWidth: 130, align: 'right', format: formatCurrency },
    { id: 'impressions', label: 'Impressions', minWidth: 120, align: 'right', format: formatNumber },
    { id: 'reach', label: 'Reach', minWidth: 120, align: 'right', format: formatNumber },
    { id: 'clicks', label: 'Clicks', minWidth: 110, align: 'right', format: formatNumber },
    { id: 'ctr', label: 'CTR', minWidth: 90, align: 'right', format: formatPercentage },
    { id: 'cpc', label: 'CPC', minWidth: 110, align: 'right', format: formatCurrency },
    { id: 'conversions', label: 'Conversions', minWidth: 120, align: 'right', format: formatNumber },
    { id: 'cpa', label: 'CPA', minWidth: 110, align: 'right', format: formatCurrency },
    { id: 'cpm', label: 'CPM', minWidth: 110, align: 'right', format: formatCurrency },
    { id: 'roas', label: 'ROAS', minWidth: 90, align: 'right', format: formatRatio },
    { id: 'conversion_rate', label: 'CR', minWidth: 90, align: 'right', format: formatPercentage },
    { id: 'frequency', label: 'Frequency', minWidth: 100, align: 'right', format: formatRatio },
];

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

const MarketingTable = ({ data, loading, error }) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    if (error) {
        return <Alert severity="error">Lỗi tải dữ liệu: {error}</Alert>;
    }

    const tableData = data || [];
    const displayedRows = tableData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Paper variant="glass" sx={{ width: '100%', overflow: 'hidden', p: 2 }}>
            <TableContainer>
                <Table stickyHeader aria-label="marketing table">
                    <TableHead>
                        <TableRow>
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    align={column.align}
                                    sx={{
                                        minWidth: column.minWidth,
                                        fontWeight: 'bold',
                                        backgroundColor: 'transparent'
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
                            displayedRows.map((row, index) => {
                                const isTotalRow = row.platform === 'Tổng cộng';
                                return (
                                    <TableRow
                                        hover
                                        key={`${row.platform}-${index}`}
                                        sx={{
                                            backgroundColor: isTotalRow ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        }}
                                    >
                                        {columns.map((column) => {
                                            const value = row[column.id];
                                            return (
                                                <TableCell
                                                    key={column.id}
                                                    align={column.align}
                                                    sx={{ fontWeight: isTotalRow ? 'bold' : 'normal' }}
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

            {!loading && tableData.length > 0 && (
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]}
                    component="div"
                    count={tableData.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={(event, newPage) => setPage(newPage)}
                    onRowsPerPageChange={(event) => {
                        setRowsPerPage(+event.target.value);
                        setPage(0);
                    }}
                    labelRowsPerPage="Số dòng:"
                    labelDisplayedRows={({ page: currentPage }) => `Trang ${currentPage + 1}`}
                    sx={{
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        '& .MuiToolbar-root': {
                            alignItems: 'center',
                            paddingTop: '4px',
                        },
                        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                            margin: 0,
                        }
                    }}
                />
            )}
        </Paper>
    );
};

export default MarketingTable;
