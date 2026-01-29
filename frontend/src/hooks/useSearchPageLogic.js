import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { searchEntitiesAPI, fetchSearchSuggestionsAPI } from '../services/api';

// Hàm debounce thủ công đơn giản
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

const useSearchPageLogic = () => {
    const { brandIdentifier: brandSlug } = useParams();
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    // Debounced function để lấy gợi ý
    const debouncedFetchSuggestions = useCallback(
        debounce(async (searchValue) => {
            const trimmedVal = searchValue.trim();
            if (trimmedVal.length < 2) {
                setSuggestions([]);
                setIsMenuOpen(false);
                return;
            }
            
            setIsLoadingSuggestions(true);
            try {
                const data = await fetchSearchSuggestionsAPI(brandSlug, trimmedVal);
                
                // [TỐI ƯU] Nếu user nhập chính xác 100% tên hoặc giá trị đã gợi ý, không cần hiện menu nữa
                const exactMatch = data && data.some(s => 
                    s.value.toLowerCase() === trimmedVal.toLowerCase() || 
                    s.label.split(' (')[0].toLowerCase() === trimmedVal.toLowerCase()
                );

                if (exactMatch) {
                    setSuggestions([]);
                    setIsMenuOpen(false);
                } else {
                    const hasSuggestions = data && data.length > 0;
                    setSuggestions(data || []);
                    setIsMenuOpen(hasSuggestions);
                }
            } catch (error) {
                console.error("Lỗi lấy gợi ý:", error);
                setSuggestions([]);
                setIsMenuOpen(false);
            } finally {
                setIsLoadingSuggestions(false);
            }
        }, 300),
        [brandSlug]
    );

    const onSearchInputChange = (newValue) => {
        setQuery(newValue);
        debouncedFetchSuggestions(newValue);
    };

    const performSearch = async (searchQuery) => {
        const trimmedQuery = searchQuery.trim();
        if (!trimmedQuery) return;

        // Đóng menu và xóa gợi ý TRƯỚC khi bắt đầu search để ẩn UI ngay lập tức
        setSuggestions([]); 
        setIsMenuOpen(false); 
        
        setIsSearching(true);
        setResult(null);
        
        try {
            const data = await searchEntitiesAPI(brandSlug, trimmedQuery);
            if (data && data.status !== 'not_found') {
                setResult(data);
            } else {
                setResult('not_found');
            }
        } catch (error) {
            console.error("Lỗi khi tìm kiếm:", error);
            setResult('not_found');
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearch = async (e) => {
        if (e.key === 'Enter' || e.type === 'click') {
            performSearch(query);
            setIsMenuOpen(false); // Đảm bảo đóng menu khi ấn Enter
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResult(null);
        setSuggestions([]);
        setIsMenuOpen(false);
    };

    return {
        query,
        setQuery, // Export raw setter để update text mà không fetch
        handleSearchChange: onSearchInputChange, // Hàm này dùng khi user GÕ phím (vừa update text vừa fetch)
        result,
        setResult,
        isSearching,
        handleSearch,
        clearSearch,
        suggestions,
        isLoadingSuggestions,
        performSearch,
        isMenuOpen,
        setIsMenuOpen
    };
};

export default useSearchPageLogic;
