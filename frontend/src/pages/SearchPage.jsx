import React from 'react';
import { 
    Box, Typography, InputAdornment, IconButton, 
    Autocomplete, CircularProgress, Paper, Stack 
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

// Icons
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import PersonIcon from '@mui/icons-material/Person';
import ReceiptIcon from '@mui/icons-material/Receipt';

// UI Components
import { MainContainer, SearchHeader, GlowingInput } from '../components/StyledComponents';

// View Components
import OrderResultView from '../components/search/OrderResultView';
import CustomerResultView from '../components/search/CustomerResultView';

// Logic Hook
import useSearchPageLogic from '../hooks/useSearchPageLogic';

function SearchPage() {
    const theme = useTheme();
    const { 
        query, setQuery, result, setResult, isSearching, 
        handleSearch, clearSearch, suggestions, 
        isLoadingSuggestions, performSearch,
        isMenuOpen, setIsMenuOpen 
    } = useSearchPageLogic();

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
                
                <Autocomplete
                    fullWidth
                    freeSolo
                    openOnFocus={false} 
                    sx={{ 
                        width: '100%',
                        maxWidth: '800px', 
                        margin: '0 auto'   
                    }}
                    open={isMenuOpen && query.length >= 2 && suggestions.length > 0} 
                    options={suggestions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.value)}
                    onInputChange={(event, newInputValue, reason) => {
                        if (reason === 'input') {
                            setQuery(newInputValue);
                        }
                    }}
                    onChange={(event, newValue) => {
                        if (newValue) {
                            const val = typeof newValue === 'string' ? newValue : newValue.value;
                            performSearch(val);
                        }
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setIsMenuOpen(false);
                            handleSearch(e);
                        }
                    }}
                    onOpen={() => {
                        if (query.length >= 2 && suggestions.length > 0) setIsMenuOpen(true);
                    }}
                    onClose={() => setIsMenuOpen(false)}
                    loading={isLoadingSuggestions}
                    renderOption={(props, option) => (
                        <Box component="li" {...props} key={option.value + option.type} sx={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                                <Box sx={{ 
                                    p: 1, borderRadius: 1, 
                                    bgcolor: option.type === 'customer' ? 'rgba(0,229,255,0.1)' : 'rgba(255,23,68,0.1)',
                                    color: option.type === 'customer' ? 'primary.main' : 'error.main'
                                }}>
                                    {option.type === 'customer' ? <PersonIcon /> : <ReceiptIcon />}
                                </Box>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>{option.label}</Typography>
                                    <Typography variant="caption" color="text.secondary">{option.sub_label}</Typography>
                                </Box>
                            </Stack>
                        </Box>
                    )}
                    PaperComponent={({ children }) => (
                        suggestions.length > 0 ? (
                            <Paper sx={{ 
                                mt: 1, 
                                bgcolor: 'rgba(20, 30, 48, 0.95)', 
                                backdropFilter: 'blur(15px)',
                                border: '1px solid rgba(0, 229, 255, 0.2)',
                                boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                            }}>
                                {children}
                            </Paper>
                        ) : null
                    )}
                    renderInput={(params) => (
                        <GlowingInput 
                            {...params}
                            sx={{
                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                '& .MuiInput-underline:before': { borderBottom: 'none' },
                                '& .MuiInput-underline:after': { borderBottom: 'none' },
                                '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderBottom: 'none' }
                            }}
                            className={isSearching ? 'searching' : ''}
                            placeholder="Nhập Mã đơn hàng, Tên khách hàng hoặc Số điện thoại..."
                            autoFocus
                            InputProps={{
                                ...params.InputProps,
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: 32, color: isSearching ? 'primary.main' : 'text.secondary' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        {isLoadingSuggestions && <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />}
                                        {query && <IconButton onClick={clearSearch}><ClearIcon /></IconButton>}
                                    </InputAdornment>
                                ),
                                'data-lpignore': "true",
                                autoComplete: 'off',
                                name: 'search_query_field'
                            }}
                        />
                    )}
                />
            </SearchHeader>

            {/* Results Area */}
            {!isSearching && result && (
                <>
                    {result === 'not_found' ? (
                        <Box sx={{ mt: 10, textAlign: 'center' }}>
                            <Typography variant="h6" color="text.secondary" sx={{ opacity: 0.8 }}>
                                🔍 Không tìm thấy kết quả phù hợp cho "{query}"
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            {result.type === 'order' && <OrderResultView data={result} />}
                            {result.type === 'customer' && <CustomerResultView data={result} />}
                        </>
                    )}
                </>
            )}
        </MainContainer>
    );
}

export default SearchPage;