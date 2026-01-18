# FILE: Backend/app/vietnam_address_mapping.py (TẠO MỚI)

from unidecode import unidecode

# Dữ liệu 34 tỉnh thành mới theo chuẩn VietMap
NEW_PROVINCES = {
    "Hà Nội": {"slug": "ha-noi", "code": "11"},
    "Hồ Chí Minh": {"slug": "ho-chi-minh", "code": "12"},
    "Đà Nẵng": {"slug": "da-nang", "code": "13"},
    "Hải Phòng": {"slug": "hai-phong", "code": "14"},
    "Cần Thơ": {"slug": "can-tho", "code": "15"},
    "Huế": {"slug": "hue", "code": "16"},
    "An Giang": {"slug": "an-giang", "code": "17"},
    "Bắc Ninh": {"slug": "bac-ninh", "code": "18"},
    "Cà Mau": {"slug": "ca-mau", "code": "19"},
    "Cao Bằng": {"slug": "cao-bang", "code": "20"},
    "Đắk Lắk": {"slug": "dak-lak", "code": "21"},
    "Điện Biên": {"slug": "dien-bien", "code": "22"},
    "Đồng Nai": {"slug": "dong-nai", "code": "23"},
    "Đồng Tháp": {"slug": "dong-thap", "code": "24"},
    "Gia Lai": {"slug": "gia-lai", "code": "25"},
    "Hà Tĩnh": {"slug": "ha-tinh", "code": "26"},
    "Hưng Yên": {"slug": "hung-yen", "code": "27"},
    "Khánh Hòa": {"slug": "khanh-hoa", "code": "28"},
    "Lai Châu": {"slug": "lai-chau", "code": "29"},
    "Lâm Đồng": {"slug": "lam-dong", "code": "30"},
    "Lạng Sơn": {"slug": "lang-son", "code": "31"},
    "Lào Cai": {"slug": "lao-cai", "code": "32"},
    "Nghệ An": {"slug": "nghe-an", "code": "33"},
    "Ninh Bình": {"slug": "ninh-binh", "code": "34"},
    "Phú Thọ": {"slug": "phu-tho", "code": "35"},
    "Quảng Ngãi": {"slug": "quang-ngai", "code": "36"},
    "Quảng Ninh": {"slug": "quang-ninh", "code": "37"},
    "Quảng Trị": {"slug": "quang-tri", "code": "38"},
    "Sơn La": {"slug": "son-la", "code": "39"},
    "Tây Ninh": {"slug": "tay-ninh", "code": "40"},
    "Thái Nguyên": {"slug": "thai-nguyen", "code": "41"},
    "Thanh Hóa": {"slug": "thanh-hoa", "code": "42"},
    "Tuyên Quang": {"slug": "tuyen-quang", "code": "43"},
    "Vĩnh Long": {"slug": "vinh-long", "code": "44"}
}

# TỪ ĐIỂN ÁNH XẠ: TỈNH CŨ -> TỈNH MỚI
# Key: Tên tỉnh cũ (đã được chuẩn hóa)
# Value: Tên tỉnh mới tương ứng
OLD_TO_NEW_MAPPING = {
    # Các tỉnh giữ nguyên tên
    "Hà Nội": "Hà Nội", "Hồ Chí Minh": "Hồ Chí Minh", "Đà Nẵng": "Đà Nẵng",
    "Hải Phòng": "Hải Phòng", "Cần Thơ": "Cần Thơ", "An Giang": "An Giang",
    "Bắc Ninh": "Bắc Ninh", "Cà Mau": "Cà Mau", "Cao Bằng": "Cao Bằng",
    "Đắk Lắk": "Đắk Lắk", "Điện Biên": "Điện Biên", "Đồng Nai": "Đồng Nai",
    "Đồng Tháp": "Đồng Tháp", "Gia Lai": "Gia Lai", "Hà Tĩnh": "Hà Tĩnh",
    "Hưng Yên": "Hưng Yên", "Khánh Hòa": "Khánh Hòa", "Lai Châu": "Lai Châu",
    "Lâm Đồng": "Lâm Đồng", "Lạng Sơn": "Lạng Sơn", "Lào Cai": "Lào Cai",
    "Nghệ An": "Nghệ An", "Ninh Bình": "Ninh Bình", "Phú Thọ": "Phú Thọ",
    "Quảng Ngãi": "Quảng Ngãi", "Quảng Ninh": "Quảng Ninh", "Quảng Trị": "Quảng Trị",
    "Sơn La": "Sơn La", "Tây Ninh": "Tây Ninh", "Thái Nguyên": "Thái Nguyên",
    "Thanh Hóa": "Thanh Hóa", "Tuyên Quang": "Tuyên Quang", "Vĩnh Long": "Vĩnh Long",

    # Các tỉnh sáp nhập hoặc đổi tên (VÍ DỤ)
    # Bạn cần bổ sung danh sách này dựa trên dữ liệu thực tế
    "An Giang": "Kiên Giang",
    "Bà Rịa - Vũng Tàu": "Hồ Chí Minh",
    "Bạc Liêu": "Cà Mau",
    "Bắc Giang": "Bắc Ninh",
    "Bắc Kạn": "Thái Nguyên",
    "Bến Tre": "Vĩnh Long",
    "Bình Dương": "Hồ Chí Minh",
    "Bình Định": "Gia Lai",
    "Bình Phước": "Đồng Nai",
    "Bình Thuận": "Lâm Đồng",
    "Cà Mau": "Cà Mau",
    "Đắk Nông": "Lâm Đồng",
    "Hà Giang": "Tuyên Quang",
    "Hà Nam": "Ninh Bình",
    "Hài Dương": "Hải Phòng",
    "Hòa Bình": "Phú Thọ",
    "Hậu Giang": "Cần Thơ",
    "Kiên Giang": "An Giang",
    "Kon Tum": "Quảng Ngãi",
    "Long An": "Tây Ninh",
    "Nam Định": "Ninh Bình",
    "Ninh Thuận": "Khánh Hòa",
    "Phú Yên": "Đắk Lắk",
    "Quảng Bình": "Quảng Trị",
    "Quảng Nam": "Đà Nẵng",
    "Sóc Trăng": "Cần Thơ",
    "Thái Bình": "Hưng Yên",
    "Tiền Giang": "Đồng Tháp",
    "Trà Vinh": "Vĩnh Long",
    "Vĩnh Phúc": "Phú Thọ",
    "Yên Bái": "Lào Cai"   
}

def get_new_province_name(old_name: str):
    """
    Chuẩn hóa và tìm tên tỉnh mới tương ứng từ một tên cũ.
    Logic: Input -> Làm sạch -> Tra cứu Mapping -> Tên Mới.
    """
    if not old_name:
        return None

    # 1. Làm sạch cơ bản
    # Xóa các tiền tố hành chính thường gặp
    cleaned_name = old_name.strip()
    prefixes = ["Tỉnh ", "Thành phố ", "TP. ", "Tp. ", "T. "]
    for prefix in prefixes:
        if cleaned_name.startswith(prefix):
            cleaned_name = cleaned_name[len(prefix):].strip()
            
    if not cleaned_name:
        return None
    
    # 2. Tra cứu chính xác
    if cleaned_name in OLD_TO_NEW_MAPPING:
        return OLD_TO_NEW_MAPPING[cleaned_name]

    # 3. Tra cứu không dấu (Fuzzy matching)
    # Tạo một bản sao mapping với key không dấu để tra cứu nhanh
    # (Lưu ý: Nên cache cái này nếu gọi nhiều, nhưng tạm thời loop cũng được vì list ngắn)
    input_unidecode = unidecode(cleaned_name).lower()
    
    for old_key, new_val in OLD_TO_NEW_MAPPING.items():
        if unidecode(old_key).lower() == input_unidecode:
            return new_val

    # 4. Nếu không tìm thấy trong mapping
    # Trả về tên đã làm sạch, hy vọng nó là tên chuẩn mới chưa kịp cập nhật vào mapping
    return cleaned_name