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
        query, setQuery, handleSearchChange, // Lấy handleSearchChange từ hook
        result, setResult, isSearching, 
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
                    disableClearable
                    filterOptions={(x) => x}
                    inputValue={query}
                    openOnFocus={false} 
                    sx={{ 
                        width: '100%',
                        maxWidth: '800px', 
                        margin: '0 auto'   
                    }}
                    open={isMenuOpen && query.length >= 2 && suggestions.length > 0} 
                    options={suggestions}
                    getOptionLabel={(option) => (typeof option === 'string' ? option : option.value)}
                    
                    // Xử lý Input Change: Phân biệt Gõ phím vs Chọn gợi ý
                    onInputChange={(event, newInputValue, reason) => {
                        if (reason === 'input') {
                            // Người dùng đang gõ -> Update text + Fetch gợi ý
                            handleSearchChange(newInputValue);
                        } else {
                            // reason là 'reset' (khi chọn item) hoặc 'clear'
                            // Chỉ update text, KHÔNG fetch lại để tránh mở lại menu
                            setQuery(newInputValue);
                        }
                    }}

                    // Xử lý khi chọn một mục từ Dropdown
                    onChange={(event, newValue) => {
                        if (newValue) {
                            const val = typeof newValue === 'string' ? newValue : newValue.value;
                            performSearch(val);
                            setIsMenuOpen(false); // Bắt buộc đóng menu ngay lập tức
                        }
                    }}

                    // Xử lý phím Enter
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            setIsMenuOpen(false); // Đóng menu
                            handleSearch(e);
                        }
                    }}

                    // Xử lý click ra ngoài (Blur)
                    onClose={(event, reason) => {
                        // Đóng menu khi click ra ngoài hoặc nhấn Esc
                        setIsMenuOpen(false);
                    }}

                    onOpen={() => {
                        if (query.length >= 2 && suggestions.length > 0) setIsMenuOpen(true);
                    }}
                    loading={isLoadingSuggestions}
                    PaperComponent={({ children }) => (
                        suggestions.length > 0 ? (
                            <Paper 
                                variant="glass" // Sử dụng variant 'glass' đã định nghĩa trong theme
                                elevation={0}
                                sx={{ 
                                    mt: 1, 
                                    // Ghi đè thêm một chút để đạt hiệu ứng "Liquid Glass" cực mượt
                                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.03))',
                                    backdropFilter: 'blur(30px) saturate(150%)',
                                    WebkitBackdropFilter: 'blur(30px) saturate(150%)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), inset 0 0 2px rgba(255,255,255,0.2)',
                                    borderRadius: '24px',
                                    overflow: 'hidden'
                                }}>
                                {children}
                            </Paper>
                        ) : null
                    )}
                    renderOption={(props, option) => (
                        <Box 
                            component="li" 
                            {...props} 
                            key={option.value + option.type} 
                            sx={{ 
                                p: '14px 24px !important', 
                                borderBottom: '1px solid rgba(255,255,255,0.05)',
                                position: 'relative',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                '&:hover': {
                                    bgcolor: 'rgba(0, 229, 255, 0.03) !important', // Tint rất rất nhẹ thay vì xám
                                    paddingLeft: '30px !important', // Hiệu ứng trượt nhẹ nội dung
                                    cursor: 'pointer',
                                    '& .highlight-text': {
                                        color: '#00E5FF', // Chuyển màu chữ chính sang Neon Cyan
                                        textShadow: '0 0 12px rgba(0, 229, 255, 0.6)', // Glow chữ
                                    },
                                    '& .icon-box': {
                                        bgcolor: option.type === 'customer' ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 23, 68, 0.2)', // Icon sáng lên
                                        transform: 'scale(1.1) rotate(5deg)', // Icon động đậy
                                        boxShadow: option.type === 'customer' ? '0 0 15px rgba(0, 229, 255, 0.4)' : '0 0 15px rgba(255, 23, 68, 0.4)'
                                    }
                                },
                                // Thanh chỉ thị bên trái (Neon Bar)
                                '&:hover::before': {
                                    content: '""',
                                    position: 'absolute',
                                    left: 0, top: '20%', bottom: '20%',
                                    width: '3px',
                                    borderRadius: '0 4px 4px 0',
                                    backgroundColor: option.type === 'customer' ? '#00E5FF' : '#FF1744',
                                    boxShadow: option.type === 'customer' ? '0 0 8px #00E5FF' : '0 0 8px #FF1744'
                                },
                                '&:last-child': {
                                    borderBottom: 'none'
                                }
                            }}
                        >
                            <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                                <Box className="icon-box" sx={{ 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: 42, height: 42,
                                    borderRadius: '12px', 
                                    bgcolor: option.type === 'customer' ? 'rgba(0,229,255,0.05)' : 'rgba(255,23,68,0.05)', // Mặc định mờ hơn
                                    color: option.type === 'customer' ? '#00E5FF' : '#FF1744',
                                    transition: 'all 0.3s ease'
                                }}>
                                    {option.type === 'customer' ? <PersonIcon /> : <ReceiptIcon />}
                                </Box>
                                <Box sx={{ flexGrow: 1 }}>
                                    {/* Thêm class highlight-text để target khi hover */}
                                    <Typography className="highlight-text" variant="body1" sx={{ fontWeight: 600, color: '#e0e0e0', transition: 'all 0.2s ease' }}>
                                        {option.label.split('(')[0]}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', display: 'block', mt: 0.3 }}>
                                        {option.type === 'customer' 
                                            ? (option.sub_label === 'Khách hàng' ? option.value : option.sub_label)
                                            : `Tracking: ${option.sub_label}`
                                        }
                                    </Typography>
                                </Box>
                            </Stack>
                        </Box>
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