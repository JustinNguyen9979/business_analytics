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
    Alert,
    TablePagination
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
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10); // Mặc định hiển thị tối đa 10 dòng

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    if (error) {
        return <Alert severity="error">Lỗi tải dữ liệu: {error}</Alert>;
    }

    const tableData = data || [];

    const displayedRows = tableData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

    return (
        <Paper variant="glass" sx={{ width: '100%', overflow: 'hidden', p: 2 }}>
            {/* BỎ maxHeight CỐ ĐỊNH ĐỂ TABLE TỰ CO GIÃN THEO NỘI DUNG */}
            <TableContainer>
                <Table stickyHeader aria-label="finance table">
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
                            // CHỈ RENDER CÁC DÒNG ĐÃ CẮT (displayedRows)
                            displayedRows.map((row, index) => {
                                const isTotalRow = row.platform === 'Tổng cộng';
                                return (
                                    <TableRow 
                                        hover 
                                        role="checkbox" 
                                        tabIndex={-1} 
                                        key={row.platform + index}
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

            {/* THANH PHÂN TRANG - CHỈ HIỆN KHI CÓ DỮ LIỆU VÀ KHÔNG ĐANG LOADING */}
            {!loading && tableData.length > 0 && (
                <TablePagination
                    rowsPerPageOptions={[5, 10, 25]} // Cho phép user chọn xem 5, 10 hoặc 25 dòng
                    component="div"
                    count={tableData.length}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    labelRowsPerPage="Số dòng:"
                    labelDisplayedRows={({ from, to, count }) => 
                        `${from}–${to} trong số ${count !== -1 ? count : `hơn ${to}`}`
                    }
                    sx={{
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                        '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                            marginBottom: 0, // Fix lỗi layout nhỏ của MUI
                        }
                    }}
                />
            )}
        </Paper>
    );
};

export default FinanceTable;
