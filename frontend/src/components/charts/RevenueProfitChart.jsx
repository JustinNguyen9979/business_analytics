// FILE: frontend/src/components/charts/RevenueProfitChart.jsx (PHIÊN BẢN SỬA LỖI CRASH CUỐI CÙNG)

import React from 'react';
import Plot from 'react-plotly.js';
import { useTheme } from '@mui/material/styles';
import { Paper, Typography, Box } from '@mui/material';
import dayjs from 'dayjs';



function RevenueProfitChart({ data, comparisonData, chartRevision, controls, filterType }) {
    const theme = useTheme();

    if (!data || data.length === 0) {
        return (
            <Paper variant="placeholder" sx={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography color="text.secondary">Không có dữ liệu để hiển thị biểu đồ.</Typography>
            </Paper>
        );
    }

    const isMonthlyView = filterType === 'year' || filterType === 'quarter';

    const aggregateDataIfNeeded = (inputData) => {
        if (!isMonthlyView) return inputData;
        const monthlyAggregates = inputData.reduce((acc, current) => {
            const monthKey = dayjs(current.date).format('YYYY-MM');
            if (!acc[monthKey]) {
                acc[monthKey] = { date: dayjs(current.date).startOf('month').toDate(), netRevenue: 0, profit: 0 };
            }
            acc[monthKey].netRevenue += current.netRevenue;
            acc[monthKey].profit += current.profit;
            return acc;
        }, {});
        return Object.values(monthlyAggregates);
    };

    // Xử lý dữ liệu kỳ hiện tại
    const currentPoints = aggregateDataIfNeeded(data);
    const currentDates = currentPoints.map(d => dayjs(d.date).toDate());
    const currentRevenues = currentPoints.map(d => d.netRevenue);
    const currentProfits = currentPoints.map(d => d.profit);

    // Xử lý dữ liệu kỳ trước
    const comparisonPoints = (comparisonData && comparisonData.length > 0) ? aggregateDataIfNeeded(comparisonData) : [];
    const dateOffset = (comparisonData && comparisonData.length > 0) ? dayjs(data[0].date).diff(dayjs(comparisonData[0].date), 'milliseconds') : 0;
    const comparisonDates = comparisonPoints.map(d => dayjs(d.date).add(dateOffset, 'milliseconds').toDate());
    const comparisonRevenues = comparisonPoints.map(d => d.netRevenue);
    const comparisonProfits = comparisonPoints.map(d => d.profit);


    // --- ĐỊNH NGHĨA BIỂU ĐỒ ---
    const chartData = [
        {
            x: comparisonDates, y: comparisonRevenues, type: 'scatter', mode: 'lines', name: 'Doanh thu ròng (Kỳ trước)',
            line: { color: theme.palette.primary.main, width: 2, dash: 'dot' },
            opacity: 0.6, connectgaps: false,
            hovertemplate: 'DTR (Kỳ trước): <b style="color: #FFD700;">%{y:,.0f} đ</b><extra></extra>',
            legendgroup: 'group1',
        },
        {
            x: comparisonDates, y: comparisonProfits, type: 'scatter', mode: 'lines', name: 'Lợi nhuận (Kỳ trước)',
            line: { color: '#28a545', width: 2, dash: 'dot' },
            opacity: 0.6, connectgaps: false,
            hovertemplate: 'LN (Kỳ trước): <b style="color: #FFD700;">%{y:,.0f} đ</b><extra></extra>',
            legendgroup: 'group2',
        },
        {
            x: currentDates, y: currentRevenues, type: 'scatter', mode: 'lines+markers', name: 'Doanh thu ròng',
            line: { color: theme.palette.primary.main, width: 2 },
            marker: { color: theme.palette.primary.main, size: 3 },
            connectgaps: false,
            hovertemplate: 'Doanh thu ròng: <b style="color: #FFD700;">%{y:,.0f} đ</b><extra></extra>',
            legendgroup: 'group3',
        },
        {
            x: currentDates, y: currentProfits, type: 'scatter', mode: 'lines+markers', name: 'Lợi nhuận',
            line: { color: '#28a545', width: 2 },
            marker: { color: '#28a545', size: 3 },
            connectgaps: false,
            hovertemplate: 'Lợi nhuận: <b style="color: #FFD700;">%{y:,.0f} đ</b><extra></extra>',
            legendgroup: 'group4',
        }
    ];

    const layout = {
        autosize: true,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        xaxis: {
            tickmode: 'linear',
            tick0: currentDates[0],
            dtick: isMonthlyView ? 'M1' : 'D1',
            tickformat: isMonthlyView ? '%b' : '%d',
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            showspikes: false,
        },
        yaxis: {
            color: theme.palette.text.secondary,
            gridcolor: theme.palette.divider,
            hoverformat: ',.0f đ', 
            rangeslider: { visible: false },
            showspikes: false,
            zeroline: false,
        },
        legend: { font: { color: theme.palette.text.secondary, size: 14 }, tracegroupgap: 10 },
        margin: { l: 80, r: 40, b: 40, t: 60 },
        hovermode: 'x',
        hoverlabel: {
            bgcolor: 'rgba(10, 25, 41, 0.9)', 
            bordercolor: theme.palette.divider, 
            font: { 
                family: 'Inter, Roboto, sans-serif',
                size: 14,
                color: '#d9d7cbff' 
            },
            namelength: -1, 
            align: 'left',
        },
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {controls}
            </Box>
            <Box sx={{ height: '450px' }}>
                <Plot
                    data={chartData}
                    layout={layout}
                    useResizeHandler={true}
                    style={{ width: '100%', height: '100%' }}
                    config={{ displayModeBar: false, responsive: true }}
                    revision={chartRevision}
                />
            </Box>
        </Box>
    );
}

export default RevenueProfitChart;