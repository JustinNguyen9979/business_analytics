import streamlit as st
import requests
import pandas as pd
import plotly.express as px

BACKEND_URL = "http://backend:8000"

def load_css(file_name):
    """
    Hàm này đọc file CSS và nhúng vào ứng dụng Streamlit.
    """
    try:
        with open(file_name) as f:
            st.markdown(f'<style>{f.read()}</style>', unsafe_allow_html=True)
    except FileNotFoundError:
        st.error(f"File CSS '{file_name}' không tìm thấy. Giao diện sẽ sử dụng mặc định.")

load_css("style.css")

def get_all_brands():
    try:
        response = requests.get(f"{BACKEND_URL}/brands/")
        response.raise_for_status()  # Sẽ báo lỗi nếu status code là 4xx hoặc 5xx
        return response.json()
    except requests.exceptions.RequestException as e:
        st.error(f"Lỗi kết nối đến backend khi lấy danh sách brand: {e}")
        return []
def create_brand(name):
    try:
        res = requests.post(f"{BACKEND_URL}/brands/", json={"name": name})
        if res.status_code == 200: st.success(f"Đã tạo brand '{name}'!"); return res.json()
        else: st.error(f"Lỗi: {res.json().get('detail')}"); return None
    except: st.error("Lỗi kết nối backend."); return None
def get_brand_details(brand_id):
    try:
        response = requests.get(f"{BACKEND_URL}/brands/{brand_id}")
        response.raise_for_status() # Sẽ báo lỗi nếu status code là 4xx hoặc 5xx
        return response.json()
    except requests.exceptions.RequestException as e:
        st.error(f"Lỗi khi tải chi tiết brand: {e}")
        return None

st.set_page_config(layout="wide", page_title="CEO Dashboard")
if 'page' not in st.session_state: st.session_state.page = 'brand_lobby'
if 'selected_brand_id' not in st.session_state: st.session_state.selected_brand_id = None

ADS_COLUMNS = {
    "campaign_name": "Tên Chiến dịch",
    "start_date": "Ngày bắt đầu",
    "impressions": "Lượt xem",
    "product_impressions": "Lượt xem SP",
    "clicks": "Lượt click",
    "product_clicks": "Lượt click SP",
    "ctr": "CTR (%)",
    "product_ctr": "CTR SP (%)",
    "conversions": "Chuyển đổi",
    "items_sold": "Sản phẩm bán được",
    "gmv": " GMV",
    "expense": "Chi phí",
    "roas": "ROAS",
    "acos": "ACOS (%)"
}

REVENUE_COLUMNS = {
    "order_code": "Mã đơn hàng",
    "order_date": "Ngày đặt hàng",
    "payment_completed_date": "Ngày thanh toán",
    "total_payment": "Tổng thanh toán",
    "product_price": "Giá sản phẩm",
    "refund_amount": "Tiền hoàn lại", 
    "shipping_fee": "Phí vận chuyển",
    "buyer_paid_shipping_fee": "Phí VC người mua trả", 
    "actual_shipping_fee": "Phí VC thực tế", 
    "shopee_subsidized_shipping_fee": "Shopee trợ giá VC", 
    "seller_voucher_code": "Mã giảm giá", 
    "fixed_fee": "Phí cố định",
    "service_fee": "Phí dịch vụ",
    "payment_fee": "Phí thanh toán",
    "commission_fee": "Phí hoa hồng", 
    "affiliate_marketing_fee": "Phí tiếp thị liên kết", 
    "buyer_username": "Người mua" 
}

# --- TRANG SẢNH CHỜ ---
if st.session_state.page == 'brand_lobby':
    st.title("Chào mừng anh đến với CEO Dashboard")
    st.header("Vui lòng chọn hoặc tạo một Brand để bắt đầu")
    
    all_brands = get_all_brands()
    if all_brands:
        brand_names = {brand['name']: brand['id'] for brand in all_brands}
        selected_brand_name = st.selectbox("Chọn Brand hiện có", options=brand_names.keys())
        if st.button("Đi đến Dashboard"):
            st.session_state.selected_brand_id = brand_names[selected_brand_name]
            st.session_state.page = 'dashboard'
            st.rerun()
    else:
        st.info("Chưa có brand nào.")
    
    st.write("---")
    with st.form("new_brand_form"):
        new_brand_name = st.text_input("Hoặc tạo Brand mới")
        if st.form_submit_button("Tạo Brand") and new_brand_name:
            if create_brand(new_brand_name): st.rerun()

# --- TRANG DASHBOARD ---
elif st.session_state.page == 'dashboard':
    brand_id = st.session_state.selected_brand_id
    brand_data = get_brand_details(brand_id)

    if brand_data:
        st.title(f"Dashboard cho Brand: {brand_data['name']}")
        if st.button("◀️ Quay lại danh sách Brand"):
            st.session_state.page = 'brand_lobby'; st.rerun()

        # --- BƯỚC 1: CHUẨN BỊ DỮ LIỆU BAN ĐẦU ---
        orders_df = pd.DataFrame(brand_data.get('orders', []))
        ads_df = pd.DataFrame(brand_data.get('shopee_ads', []))
        revenues_df = pd.DataFrame(brand_data.get('shopee_revenues', []))
        customers_df = pd.DataFrame(brand_data.get('customers', []))

        # Chuyển đổi các cột ngày tháng sang định dạng datetime
        if not orders_df.empty: orders_df['order_date'] = pd.to_datetime(orders_df['order_date'], errors='coerce')
        if not ads_df.empty: ads_df['start_date'] = pd.to_datetime(ads_df['start_date'], errors='coerce')
        if not revenues_df.empty: revenues_df['payment_completed_date'] = pd.to_datetime(revenues_df['payment_completed_date'], errors='coerce')

        # --- BƯỚC 2: TẠO GIAO DIỆN BỘ LỌC NGÀY THÁNG ---
        st.header("📅 Bộ lọc Dữ liệu theo Thời gian")
        
        # Tìm ngày nhỏ nhất và lớn nhất trong tất cả các bộ dữ liệu
        all_dates = pd.concat([
            orders_df['order_date'],
            ads_df['start_date'],
            revenues_df['payment_completed_date']
        ]).dropna()

        if not all_dates.empty:
            min_date = all_dates.min().date()
            max_date = all_dates.max().date()

            col_start, col_end = st.columns(2)
            with col_start:
                start_date_filter = st.date_input("Từ ngày", min_date, min_value=min_date, max_value=max_date)
            with col_end:
                end_date_filter = st.date_input("Đến ngày", max_date, min_value=min_date, max_value=max_date)
        else:
            st.info("Chưa có dữ liệu ngày tháng để lọc.")
            start_date_filter, end_date_filter = None, None

        # --- BƯỚC 3: LỌC DỮ LIỆU DỰA TRÊN BỘ LỌC ---
        if start_date_filter and end_date_filter:
            start_datetime = pd.to_datetime(start_date_filter)
            end_datetime = pd.to_datetime(end_date_filter)

            filtered_orders_df = orders_df[orders_df['order_date'].between(start_datetime, end_datetime)]
            filtered_ads_df = ads_df[ads_df['start_date'].between(start_datetime, end_datetime)]
            filtered_revenues_df = revenues_df[revenues_df['payment_completed_date'].between(start_datetime, end_datetime)]
            # Dữ liệu khách hàng không có ngày, ta sẽ tính lại dựa trên đơn hàng đã lọc
            if not filtered_orders_df.empty:
                 # Lấy username duy nhất từ các đơn hàng đã lọc
                filtered_customer_usernames = filtered_orders_df['username'].unique()
                # Lọc bảng khách hàng dựa trên danh sách username đó
                filtered_customers_df = customers_df[customers_df['username'].isin(filtered_customer_usernames)]
            else:
                filtered_customers_df = pd.DataFrame()
        else: # Nếu không có bộ lọc, dùng dữ liệu gốc
            filtered_orders_df = orders_df
            filtered_ads_df = ads_df
            filtered_revenues_df = revenues_df
            filtered_customers_df = customers_df

        # --- BƯỚC 4: TÍNH TOÁN VÀ HIỂN THỊ KPI DỰA TRÊN DỮ LIỆU ĐÃ LỌC ---
        st.write("---")
        st.header("📊 Chỉ số Hiệu suất Chính (KPIs)")
        
        # Sử dụng các DataFrame đã lọc để tính toán
        total_orders = len(filtered_orders_df)
        cancelled_orders = len(filtered_orders_df[filtered_orders_df['status'] == 'Đã hủy'])
        total_customers = len(filtered_customers_df)
        cancellation_rate = (cancelled_orders / total_orders * 100) if total_orders > 0 else 0
        
        total_ad_spend = filtered_ads_df['expense'].sum()
        total_gmv_from_ads = filtered_ads_df['gmv'].sum()
        total_revenue_payment = filtered_revenues_df['total_payment'].sum()
        
        # Hiển thị KPI (giữ nguyên)
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Tổng đơn hàng", f"{total_orders:,}")
            st.metric("Tổng chi phí QC", f"{total_ad_spend:,.0f} đ")
        with col2:
            st.metric("Số đơn hủy", f"{cancelled_orders:,}")
            st.metric("Doanh thu từ QC (GMV)", f"{total_gmv_from_ads:,.0f} đ")
        with col3:
            st.metric("Tỷ lệ hủy", f"{cancellation_rate:.2f}%")
            st.metric("Tổng doanh thu thực nhận", f"{total_revenue_payment:,.0f} đ")
        with col4:
            st.metric("Tổng khách hàng", f"{total_customers:,}")
            overall_roas = (total_gmv_from_ads / total_ad_spend) if total_ad_spend > 0 else 0
            st.metric("ROAS Tổng", f"{overall_roas:.2f}")

        # --- BƯỚC 5: VẼ BIỂU ĐỒ VÀ HIỂN THỊ BẢNG DỰA TRÊN DỮ LIỆU ĐÃ LỌC ---
        # (Toàn bộ logic vẽ biểu đồ và hiển thị bảng bây giờ sẽ dùng các DataFrame đã lọc)
        
        st.write("---")
        st.header("📈 Phân tích và Trực quan hóa Dữ liệu")

        # BIỂU ĐỒ 1
        st.subheader("Doanh thu và Chi phí Quảng cáo theo Thời gian")
        if not filtered_ads_df.empty or not filtered_revenues_df.empty:
            # Dùng filtered_ads_df và filtered_revenues_df thay vì tạo mới
            daily_ads = filtered_ads_df.groupby(filtered_ads_df['start_date'].dt.date).agg(total_expense=('expense', 'sum'), total_gmv=('gmv', 'sum')).reset_index().rename(columns={'start_date': 'date'})
            daily_revenue = filtered_revenues_df.groupby(filtered_revenues_df['payment_completed_date'].dt.date).agg(total_payment=('total_payment', 'sum')).reset_index().rename(columns={'payment_completed_date': 'date'})
            df_merged = pd.merge(daily_ads, daily_revenue, on='date', how='outer').fillna(0).sort_values('date')
            # (Phần code vẽ biểu đồ px.line giữ nguyên)
            fig_line = px.line(df_merged, x='date', y=['total_payment', 'total_gmv', 'total_expense'],
                               title="Tổng quan Doanh thu và Chi phí Quảng cáo",
                               labels={'value': 'Số tiền (đ)', 'date': 'Ngày', 'variable': 'Chỉ số'},
                               color_discrete_map={
                                   'total_payment': '#1f77b4',
                                   'total_gmv': '#2ca02c',
                                   'total_expense': '#d62728'
                               })
            fig_line.update_layout(yaxis_title='Số tiền (đ)')
            st.plotly_chart(fig_line, use_container_width=True)
        else:
            st.info("Không có dữ liệu trong khoảng thời gian đã chọn để vẽ biểu đồ này.")
        
        # BIỂU ĐỒ 2
        st.subheader("Phân tích Hiệu quả Chiến dịch Quảng cáo (theo ROAS)")
        if not filtered_ads_df.empty:
            # (Toàn bộ logic vẽ biểu đồ cột Top 5 giữ nguyên, chỉ thay df_ads_chart bằng filtered_ads_df)
            df_ads_perf = filtered_ads_df.groupby('campaign_name').agg(total_gmv=('gmv', 'sum'), total_expense=('expense', 'sum')).reset_index()
            df_ads_perf['roas'] = df_ads_perf.apply(lambda row: row['total_gmv'] / row['total_expense'] if row['total_expense'] > 0 else 0, axis=1)
            df_ads_perf = df_ads_perf.sort_values('roas', ascending=False)
            col_top, col_bottom = st.columns(2)
            with col_top:
                #... (code vẽ biểu đồ top 5 giữ nguyên)
                st.write("🚀 Top 5 Chiến dịch Hiệu quả nhất")
                fig_bar_top = px.bar(df_ads_perf.head(5), x='roas', y='campaign_name', orientation='h',
                                     title="Top 5 Chiến dịch theo ROAS",
                                     labels={'roas': 'ROAS (Doanh thu / Chi phí)', 'campaign_name': 'Tên Chiến dịch'},
                                     text='roas')
                fig_bar_top.update_traces(texttemplate='%{text:.2f}', textposition='outside')
                st.plotly_chart(fig_bar_top, use_container_width=True)
            
            with col_bottom:
                st.write("🔻 Top 5 Chiến dịch Kém hiệu quả nhất")
                # Lọc ra các chiến dịch có chi phí > 0 để tránh các chiến dịch chưa chạy
                df_bottom = df_ads_perf[df_ads_perf['total_expense'] > 0].sort_values('roas', ascending=True)
                fig_bar_bottom = px.bar(df_bottom.head(5), x='roas', y='campaign_name', orientation='h',
                                        title="Top 5 Chiến dịch kém hiệu quả theo ROAS",
                                        labels={'roas': 'ROAS (Doanh thu / Chi phí)', 'campaign_name': 'Tên Chiến dịch'},
                                        text='roas')
                fig_bar_bottom.update_traces(texttemplate='%{text:.2f}', textposition='outside')
                st.plotly_chart(fig_bar_bottom, use_container_width=True)

        else:
            st.info("Không có dữ liệu Quảng cáo trong khoảng thời gian đã chọn.")
        
        # BIỂU ĐỒ 3
        st.subheader("Phân tích Cơ cấu Chi phí trong Doanh thu")
        if not filtered_revenues_df.empty:
            # (Toàn bộ logic vẽ biểu đồ tròn giữ nguyên, chỉ thay df_revenue_chart bằng filtered_revenues_df)
            total_payment = filtered_revenues_df['total_payment'].sum()
            total_fixed_fee = filtered_revenues_df['fixed_fee'].sum()
            total_service_fee = filtered_revenues_df['service_fee'].sum()
            total_payment_fee = filtered_revenues_df['payment_fee'].sum()
            total_commission_fee = filtered_revenues_df['commission_fee'].sum()
            total_fees = total_fixed_fee + total_service_fee + total_payment_fee + total_commission_fee
            net_profit = total_payment - total_fees
            df_pie = pd.DataFrame({'Loại chi phí': ['Lợi nhuận thực nhận', 'Phí cố định', 'Phí dịch vụ', 'Phí thanh toán', 'Phí hoa hồng'],
                                'Số tiền': [net_profit, total_fixed_fee, total_service_fee, total_payment_fee, total_commission_fee]})
            fig_donut = px.pie(df_pie, values='Số tiền', names='Loại chi phí', 
                               title='Phân bổ Doanh thu Thực nhận', hole=.4)
            st.plotly_chart(fig_donut, use_container_width=True)
        else:
            st.info("Không có dữ liệu Doanh thu trong khoảng thời gian đã chọn.")

        # --- HIỂN THỊ DỮ LIỆU MỚI (DẠNG BẢNG) ---
        st.header("📋 Dữ liệu Vừa Import")
        tab1, tab2 = st.tabs(["Dữ liệu Quảng cáo", "Dữ liệu Doanh thu"])

        with tab1:
            if brand_data.get('shopee_ads'):
                df_ads = pd.DataFrame(brand_data['shopee_ads'])
                
                # Định nghĩa cách hiển thị cho từng cột
                column_config_ads = {
                    "campaign_name": st.column_config.TextColumn("Tên Chiến dịch"),
                    "start_date": st.column_config.DateColumn("Ngày bắt đầu", format="DD/MM/YYYY"),
                    "impressions": st.column_config.NumberColumn("Lượt xem", format="%d"),
                    "clicks": st.column_config.NumberColumn("Lượt click", format="%d"),
                    "ctr": st.column_config.NumberColumn("CTR (%)", format="%.2f%%"),
                    "conversions": st.column_config.NumberColumn("Chuyển đổi", format="%d"),
                    "items_sold": st.column_config.NumberColumn("Sản phẩm bán được", format="%d"),
                    "gmv": st.column_config.NumberColumn("Doanh thu (GMV)", format="%d đ"),
                    "expense": st.column_config.NumberColumn("Chi phí", format="%d đ"),
                    "roas": st.column_config.NumberColumn("ROAS", format="%.2f"),
                    "direct_roas": st.column_config.NumberColumn("ROAS Trực tiếp", format="%.2f"),
                    "acos": st.column_config.NumberColumn("ACOS (%)", format="%.2f%%"),
                    "direct_acos": st.column_config.NumberColumn("ACOS Trực tiếp (%)", format="%.2f%%"),
                    "product_impressions": st.column_config.NumberColumn("Lượt xem SP", format="%d"),
                    "product_clicks": st.column_config.NumberColumn("Lượt click SP", format="%d"),
                    "product_ctr": st.column_config.NumberColumn("CTR SP (%)", format="%.2f%%"),
                }
                
                st.dataframe(df_ads, column_config=column_config_ads, use_container_width=True,
                            # Ẩn các cột không cần thiết
                            hide_index=True, column_order=list(column_config_ads.keys()))
            else:
                st.info("Chưa có dữ liệu quảng cáo.")

        with tab2:
            if brand_data.get('shopee_revenues'):
                df_revenue = pd.DataFrame(brand_data['shopee_revenues'])

                # Định nghĩa cách hiển thị cho từng cột
                column_config_revenue = {
                    "order_code": "Mã đơn hàng",
                    "order_date": st.column_config.DateColumn("Ngày đặt hàng", format="DD/MM/YYYY"),
                    "payment_completed_date": st.column_config.DateColumn("Ngày thanh toán", format="DD/MM/YYYY"),
                    "total_payment": st.column_config.NumberColumn("Tổng thanh toán", format="%d đ"),
                    "product_price": st.column_config.NumberColumn("Giá sản phẩm", format="%d đ"),
                    "refund_amount": st.column_config.NumberColumn("Tiền hoàn lại", format="%d đ"),
                    "shipping_fee": st.column_config.NumberColumn("Phí vận chuyển", format="%d đ"),
                    "buyer_paid_shipping_fee": st.column_config.NumberColumn("Phí VC người mua trả", format="%d đ"),
                    "actual_shipping_fee": st.column_config.NumberColumn("Phí VC thực tế", format="%d đ"),
                    "shopee_subsidized_shipping_fee": st.column_config.NumberColumn("Shopee trợ giá VC", format="%d đ"),
                    "seller_voucher_code": "Mã giảm giá",
                    "fixed_fee": st.column_config.NumberColumn("Phí cố định", format="%d đ"),
                    "service_fee": st.column_config.NumberColumn("Phí dịch vụ", format="%d đ"),
                    "payment_fee": st.column_config.NumberColumn("Phí thanh toán", format="%d đ"),
                    "commission_fee": st.column_config.NumberColumn("Phí hoa hồng", format="%d đ"),
                    "affiliate_marketing_fee": st.column_config.NumberColumn("Phí tiếp thị liên kết", format="%d đ"),
                    "buyer_username": "Người mua"
                }
                
                st.dataframe(df_revenue, column_config=column_config_revenue, use_container_width=True,
                            hide_index=True, column_order=list(column_config_revenue.keys()))
            else:
                st.info("Chưa có dữ liệu doanh thu.")
        
        st.write("---")
        st.subheader("Xóa dữ liệu cũ")
        st.warning("Hành động này sẽ xóa vĩnh viễn dữ liệu đã chọn của brand này. Hãy cẩn thận.")
        
        # Form xóa dữ liệu
        data_types_to_delete = st.multiselect(
            "Chọn loại dữ liệu cần xóa:",
            options=['products', 'orders', 'ads', 'revenues'],
            key=f"delete_multiselect_{brand_id}"
        )
        
        if st.button("Xóa Dữ liệu đã chọn", key=f"delete_button_{brand_id}"):
            if data_types_to_delete:
                with st.spinner("Đang xóa..."):
                    response = requests.post(f"{BACKEND_URL}/brands/{brand_id}/delete-data", json={"data_types": data_types_to_delete})
                    if response.status_code == 200:
                        st.success(response.json().get('message'))
                        st.rerun() # Tải lại trang để cập nhật
                    else:
                        st.error(f"Lỗi khi xóa dữ liệu: {response.text}")
            else:
                st.warning("Vui lòng chọn ít nhất một loại dữ liệu để xóa.")