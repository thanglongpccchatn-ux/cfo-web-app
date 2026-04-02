import psycopg2
import csv
import os
from datetime import datetime

# ==========================================
# CẤU HÌNH DATABASE SUPABASE CỦA MÀY Ở ĐÂY
# Vào Supabase -> Đăng nhập -> Project Settings -> Database
# Xem phần "Connection string" -> (URI)
# ==========================================
DB_URL = "postgresql://postgres.laoadqoisidnbgaqjsbw:Minh.son0411@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres"

# THƯ MỤC LƯU BACKUP
BACKUP_DIR = r"E:\AG\Backups"

def backup_supabase():
    print("🚀 Bắt đầu quá trình Backup dữ liệu tự động từ Supabase...")
    
    # Tạo thư mục con theo ngày giờ hiện tại
    today_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    folder_path = os.path.join(BACKUP_DIR, f"backup_{today_str}")
    
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

    try:
        # Kết nối tới Database (bỏ qua SSL vì pooler của Supabase mặc định mã hóa)
        conn = psycopg2.connect(DB_URL)
        cur = conn.cursor()

        # Lấy danh sách tất cả các bảng trong hệ thống của mày (schema public)
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE';
        """)
        
        tables = [row[0] for row in cur.fetchall()]
        print(f"📦 Đã tìm thấy {len(tables)} bảng dữ liệu: {', '.join(tables)}")

        for table in tables:
            csv_path = os.path.join(folder_path, f"{table}.csv")
            
            # Quét dữ liệu từng bảng và tải thẳng về file CSV
            with open(csv_path, 'w', encoding='utf-8', newline='') as f:
                # `COPY` là lệnh tốc độ cao của Postgres để tải/up data
                cur.copy_expert(f"COPY public.{table} TO STDOUT WITH CSV HEADER", f)
                
            print(f"✅ Đã tải xong bảng: {table} -> {csv_path}")

        cur.close()
        conn.close()
        
        print("\n🎉 HOÀN TẤT TẤT CẢ BACKUP!")
        print(f"📂 File Excel (CSV) của mày được cất an toàn tại: {folder_path}")
        
    except Exception as e:
        print(f"\n❌ LỖI RỒI ĐẠI CA CƠI: {e}")
        print("Mày nhớ kiểm tra lại chuỗi kết nối DB_URL ở dòng 9 xem đúng chưa nhé.")

if __name__ == "__main__":
    backup_supabase()
    input("\nBấm nút Enter để thoát...")
