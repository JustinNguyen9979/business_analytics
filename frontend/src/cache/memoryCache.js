// FILE: frontend/src/cache/memoryCache.js

/**
 * Một cache đơn giản trong bộ nhớ (in-memory) sử dụng Map.
 * Cache này sẽ bị xóa hoàn toàn khi người dùng tải lại trang (F5).
 */
const cache = new Map();

const MAX_CACHE_SIZE = 2; // Giới hạn số lượng mục trong cache

/**
 * Tạo ra một cache key nhất quán từ các tham số request.
 * @param {string} requestType - Loại dữ liệu (vd: 'kpi_summary').
 * @param {string} brandId - ID của brand.
 * @param {Array<dayjs>} dateRange - Mảng [startDate, endDate].
 * @returns {string} - Một chuỗi key duy nhất cho cache.
 */
export const generateCacheKey = (requestType, brandId, dateRange) => {
    if (!requestType || !brandId || !dateRange || dateRange.length < 2) {
        return null;
    }
    const [start, end] = dateRange;
    const startStr = start.format('YYYY-MM-DD');
    const endStr = end.format('YYYY-MM-DD');
    return `brand-${brandId}:${requestType}:${startStr}:${endStr}`;
};

export const memoryCache = {
  /**
   * Lấy một giá trị từ cache.
   * @param {string} key - Key của cache.
   * @returns {*} - Giá trị được cache hoặc undefined nếu không tìm thấy.
   */
  get(key) {
    return cache.get(key);
  },

  /**
   * Lưu một giá trị vào cache.
   * @param {string} key - Key của cache.
   * @param {*} value - Giá trị cần lưu.
   */
  set(key, value) {
    // Nếu cache đã đầy, xóa mục cũ nhất (theo thứ tự thêm vào của Map)
    if (cache.size >= MAX_CACHE_SIZE) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
      console.log(`Cache full. Evicted oldest key: ${oldestKey}`);
    }
    cache.set(key, value);
  },

  /**
   * Xóa toàn bộ cache.
   */
  clear() {
    console.log("Client-side memory cache cleared.");
    cache.clear();
  },
};
