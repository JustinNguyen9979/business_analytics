import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { searchEntitiesAPI } from '../services/api';

const useSearchPageLogic = () => {
    const { brandIdentifier: brandSlug } = useParams();
    const [query, setQuery] = useState('');
    const [result, setResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);

    const handleSearch = async (e) => {
        // Chỉ kích hoạt khi nhấn Enter hoặc Click nút search
        if (e.key === 'Enter' || e.type === 'click') {
            const trimmedQuery = query.trim();
            if (!trimmedQuery) return;

            setIsSearching(true);
            setResult(null);
            
            try {
                // Gọi API tìm kiếm thực tế từ Backend
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
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResult(null);
    };

    return {
        query,
        setQuery,
        result,
        setResult,
        isSearching,
        handleSearch,
        clearSearch
    };
};

export default useSearchPageLogic;