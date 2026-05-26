import os
import uuid
import zipfile
from io import BytesIO
from fastapi import UploadFile, HTTPException
from PIL import Image
from app.config import settings

class FileService:
    @staticmethod
    def validate_file_extension(filename: str):
        """Kiểm tra xem phần mở rộng file có hợp lệ hay không"""
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Định dạng file '.{ext}' không được phép. Chỉ cho phép các định dạng: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
        
        # Danh sách đen định dạng thực thi nguy hiểm
        dangerous_extensions = {'exe', 'bat', 'sh', 'elf', 'msi', 'scr', 'cmd', 'vbs', 'js', 'py'}
        if ext in dangerous_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File thực thi nguy hiểm '.{ext}' bị cấm tuyệt đối vì lý do an toàn bảo mật."
            )
        return ext

    @staticmethod
    def sanitize_image(upload_file: UploadFile) -> bytes:
        """Đọc ảnh chụp màn hình tải lên, re-encode để triệt tiêu mọi metadata và stegano payload"""
        try:
            # Đọc file ảnh dưới dạng Bytes
            img_bytes = upload_file.file.read()
            img = Image.open(BytesIO(img_bytes))
            
            # Re-encode: lưu ảnh ra một stream bytes mới, loại bỏ EXIF
            output = BytesIO()
            # Convert sang RGB nếu là RGBA để tránh lỗi khi save JPEG, 
            # tuy nhiên PNG hỗ trợ RGBA nên có thể giữ nguyên nếu lưu dạng PNG.
            # Lưu lại định dạng PNG để giữ chất lượng ảnh chụp màn hình sắc nét.
            img.save(output, format="PNG", exif=b"")
            upload_file.file.seek(0) # Trỏ lại đầu file
            return output.getvalue()
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Lỗi khi xử lý làm sạch ảnh chụp màn hình: {str(e)}"
            )

    @staticmethod
    def process_and_scan_zip(filepath: str) -> dict:
        """
        Mở file zip mã hóa bằng mật khẩu mặc định 'infected', 
        giải nén trong bộ nhớ để giả lập quét mã độc (ClamAV/Yara)
        """
        scan_results = {
            "status": "clean",
            "extracted_files": [],
            "threats_found": [],
            "scanned": False
        }
        
        if not zipfile.is_zipfile(filepath):
            return scan_results

        try:
            with zipfile.ZipFile(filepath) as zf:
                # Kiểm tra xem có bị mã hóa (password protected) hay không
                # Bằng cách xem info của các file bên trong
                is_encrypted = any(zinfo.flag_bits & 0x1 for zinfo in zf.infolist())
                
                if is_encrypted:
                    try:
                        # Thử giải nén với mật khẩu mặc định 'infected'
                        zf.setpassword(b'infected')
                        # Thử đọc thử file đầu tiên để test pass
                        zf.read(zf.namelist()[0])
                    except Exception:
                        raise HTTPException(
                            status_code=400,
                            detail="File zip bị khóa mật khẩu. Theo quy định môn học, vui lòng sử dụng mật khẩu 'infected' để hệ thống tự động quét an toàn."
                        )
                
                scan_results["scanned"] = True
                # Đọc danh sách file và thực hiện quét
                for filename in zf.namelist():
                    # Tránh thư mục trống
                    if filename.endswith('/'):
                        continue
                    
                    scan_results["extracted_files"].append(filename)
                    
                    # Giả lập quét Yara hoặc chữ ký ClamAV
                    # Ví dụ: cấm các file thực thi nhét bên trong zip báo cáo
                    file_ext = filename.split('.')[-1].lower() if '.' in filename else ''
                    if file_ext in {'exe', 'bat', 'sh', 'elf', 'msi', 'scr', 'dll'}:
                        scan_results["status"] = "infected"
                        scan_results["threats_found"].append(
                            f"Phát hiện file thực thi độc hại nằm trong zip: {filename}"
                        )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(
                status_code=400,
                detail=f"Lỗi khi xử lý giải nén quét file zip báo cáo: {str(e)}"
            )
            
        return scan_results

    @staticmethod
    def save_uploaded_file(upload_file: UploadFile, is_image: bool = False) -> dict:
        """Lưu trữ file tải lên vào đĩa sau khi đã được thẩm định an toàn"""
        ext = FileService.validate_file_extension(upload_file.filename)
        
        # Đảm bảo thư mục lưu trữ tồn tại
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        
        # Sinh tên file ngẫu nhiên an toàn để tránh bị ghi đè hoặc tấn công Path Traversal
        safe_filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(settings.UPLOAD_DIR, safe_filename)
        
        if is_image and ext in {'png', 'jpg', 'jpeg'}:
            # Làm sạch ảnh trước khi lưu
            cleaned_bytes = FileService.sanitize_image(upload_file)
            with open(filepath, "wb") as f:
                f.write(cleaned_bytes)
        else:
            # Lưu file thông thường
            with open(filepath, "wb") as f:
                content = upload_file.file.read()
                f.write(content)
        
        # Nếu là file zip, chạy quét bảo mật ảo
        zip_scan = None
        if ext == 'zip':
            zip_scan = FileService.process_and_scan_zip(filepath)
            if zip_scan["status"] == "infected":
                # Xóa file ngay lập tức nếu nhiễm độc để bảo vệ hệ thống!
                try:
                    os.remove(filepath)
                except Exception:
                    pass
                raise HTTPException(
                    status_code=400,
                    detail=f"Từ chối tải lên! Phát hiện nguy cơ bảo mật: {', '.join(zip_scan['threats_found'])}"
                )
                
        return {
            "original_filename": upload_file.filename,
            "saved_filename": safe_filename,
            "filepath": filepath,
            "ext": ext,
            "zip_scan_details": zip_scan
        }
