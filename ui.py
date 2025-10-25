import streamlit as st
import requests
import pandas as pd

# Cấu hình API endpoint của backend
BACKEND_URL = "http://backend:8000" # Dùng tên service 'backend' trong Docker

# --- Hàm gọi API ---
def get_all_brands():
    """Lấy danh sách tất cả các brand từ API (tạm thời chưa có API này, sẽ xây dựng sau)"""
    # Hiện tại chúng ta sẽ giả lập dữ liệu
    # Ở bước sau, chúng ta sẽ thay thế bằng lệnh gọi API thật
    # response = requests.get(f"{BACKEND_URL}/brands/")
    # if response.status_code == 200:
    #     return response.json()
    return [] # Giả sử ban đầu chưa có brand nào

def create_brand(name: str):
    """Tạo brand mới qua API"""
    try:
        response = requests.post(f"{BACKEND_URL}/brands/", json={"name": name})
        if response.status_code == 200:
            return response.json()
        else:
            st.error(f"Lỗi tạo brand: {response.json().get('detail')}")
            return None
    except requests.exceptions.ConnectionError:
        st.error("Không thể kết nối đến backend. Vui lòng đảm bảo backend đang chạy.")
        return None

def get_brand_details(brand_id: int):
    """Lấy chi tiết dữ liệu của một brand"""
    try:
        response = requests.get(f"{BACKEND_URL}/brands/{brand_id}")
        if response.status_code == 200:
            return response.json()
        else:
            return None
    except requests.exceptions.ConnectionError:
        st.error("Lỗi kết nối backend.")
        return None

# --- Bố cục Trang ---
st.set_page_config(layout="wide", page_title="CEO Dashboard")

# Sử dụng session state để lưu trạng thái trang
if 'page' not in st.session_state:
    st.session_state.page = 'brand_lobby'
if 'selected_brand_id' not in st.session_state:
    st.session_state.selected_brand_id = None

# --- Trang 1: Sảnh chờ Brand ---
if st.session_state.page == 'brand_lobby':
    st.title("Chào mừng anh đến với CEO Dashboard")
    st.header("Vui lòng chọn hoặc tạo một Brand để bắt đầu")

    # TODO: Ở bước sau, chúng ta sẽ hiện danh sách brand ở đây
    st.write("Hiện tại chưa có brand nào.")
    st.write("---")

    # Khu vực tạo brand mới
    st.subheader("Tạo Brand mới")
    with st.form("new_brand_form"):
        new_brand_name = st.text_input("Tên Brand")
        submitted = st.form_submit_button("Tạo Brand")
        if submitted and new_brand_name:
            new_brand = create_brand(new_brand_name)
            if new_brand:
                st.success(f"Đã tạo thành công Brand '{new_brand['name']}'!")
                # Tạm thời chưa có danh sách nên chưa refresh được
    
    # Giả lập chọn brand để test
    # Sau này sẽ thay bằng click vào danh sách
    test_brand_id = st.number_input("Nhập Brand ID để xem Dashboard (Test)", min_value=1, step=1)
    if st.button("Đi đến Dashboard"):
        st.session_state.selected_brand_id = test_brand_id
        st.session_state.page = 'dashboard'
        st.experimental_rerun()


# --- Trang 2: Dashboard Chi tiết ---
elif st.session_state.page == 'dashboard':
    brand_id = st.session_state.selected_brand_id
    brand_data = get_brand_details(brand_id)

    if brand_data:
        st.title(f"Dashboard cho Brand: {brand_data['name']}")
        
        # Nút để quay lại
        if st.button("◀️ Quay lại danh sách Brand"):
            st.session_state.page = 'brand_lobby'
            st.session_state.selected_brand_id = None
            st.experimental_rerun()
            
        st.write("---")

        # --- HIỂN THỊ CÁC CHỈ SỐ KPI ---
        st.header("📊 Chỉ số Hiệu suất Chính (KPIs)")
        
        orders = brand_data.get('orders', [])
        customers = brand_data.get('customers', [])
        
        total_orders = len(orders)
        cancelled_orders = len([o for o in orders if o['status'] == 'Đã hủy'])
        total_customers = len(customers)
        
        cancellation_rate = (cancelled_orders / total_orders * 100) if total_orders > 0 else 0
        
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("Tổng đơn hàng", f"{total_orders}")
        col2.metric("Số đơn hủy", f"{cancelled_orders}")
        col3.metric("Tỷ lệ hủy", f"{cancellation_rate:.2f}%")
        col4.metric("Tổng khách hàng", f"{total_customers}")

        # --- BIỂU ĐỒ ĐẦU TIÊN ---
        st.header("📈 Phân tích Đơn hàng")
        if orders:
            df_orders = pd.DataFrame(orders)
            df_orders['order_date'] = pd.to_datetime(df_orders['order_date']).dt.date
            
            orders_by_date = df_orders.groupby('order_date').size().reset_index(name='count')
            
            st.subheader("Số lượng đơn hàng theo ngày")
            st.bar_chart(orders_by_date.rename(columns={'order_date':'Ngày', 'count':'Số đơn hàng'}).set_index('Ngày'))
        else:
            st.info("Chưa có dữ liệu đơn hàng để vẽ biểu đồ.")

    else:
        st.error(f"Không thể tải dữ liệu cho Brand ID: {brand_id}")
        if st.button("◀️ Quay lại"):
            st.session_state.page = 'brand_lobby'
            st.experimental_rerun()