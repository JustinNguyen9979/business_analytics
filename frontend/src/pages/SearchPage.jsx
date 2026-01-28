import React from 'react';
import { Box, Typography, InputAdornment, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';

// UI Components
import { MainContainer, SearchHeader, GlowingInput } from '../components/StyledComponents';

// View Components
import OrderResultView from '../components/search/OrderResultView';
import CustomerResultView from '../components/search/CustomerResultView';

// Logic Hook
import useSearchPageLogic from '../hooks/useSearchPageLogic';

function SearchPage() {
    const theme = useTheme();
    const { query, setQuery, result, isSearching, handleSearch, clearSearch } = useSearchPageLogic();

    return (
        <MainContainer>
            {/* Header Area */}
            <SearchHeader hasResult={!!result}>
                {!result && (
                    <Box sx={{ textAlign: 'center', mb: 5 }}>
                        <Typography variant="h2" sx={{ 
                            fontWeight: 900, 
                            letterSpacing: '8px',
                            background: `linear-gradient(to right, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            mb: 1,
                            textTransform: 'uppercase',
                            filter: 'drop-shadow(0 0 15px rgba(0, 229, 255, 0.3))'
                        }}>
                            Discovery
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ letterSpacing: '2px', opacity: 0.7 }}>
                            TRUY VẾT DỮ LIỆU & PHÂN TÍCH CHỈ SỐ KINH DOANH
                        </Typography>
                    </Box>
                )}
                
                <GlowingInput 
                    className={isSearching ? 'searching' : ''}
                    placeholder="Nhập Mã đơn hàng, Tên khách hàng hoặc Số điện thoại..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    autoFocus
                    inputProps={{
                        'data-lpignore': "true",
                        autoComplete: 'off',
                        name: 'search_query_field'
                    }}
                    InputProps={{
                        startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 32, color: isSearching ? 'primary.main' : 'text.secondary' }} /></InputAdornment>,
                        endAdornment: query && <InputAdornment position="end"><IconButton onClick={clearSearch}><ClearIcon /></IconButton></InputAdornment>
                    }}
                />
            </SearchHeader>

            {/* Results Area - Cleaner & Modular */}
            {!isSearching && result && (
                <>
                    {result.type === 'order' && <OrderResultView data={result} />}
                    {result.type === 'customer' && <CustomerResultView data={result} />}
                </>
            )}
        </MainContainer>
    );
}

export default SearchPage;