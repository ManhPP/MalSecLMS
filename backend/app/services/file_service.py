import os
import re
import uuid
import zipfile
import hashlib
from io import BytesIO
from fastapi import UploadFile, HTTPException
from PIL import Image
from app.config import settings
from app.logging_config import logger

class FileService:
    @staticmethod
    def validate_file_extension(filename: str):
        """Kiểm tra xem phần mở rộng file có hợp lệ hay không"""
        ext = filename.split('.')[-1].lower() if '.' in filename else ''
        if ext not in settings.ALLOWED_EXTENSIONS:
            logger.warning(f"[FILE_REJECTED] Filename: '{filename}' | Reason: Disallowed extension '.{ext}'")
            raise HTTPException(
                status_code=400,
                detail=f"Định dạng file '.{ext}' không được phép. Chỉ cho phép các định dạng: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
        
        # Danh sách đen định dạng thực thi nguy hiểm
        dangerous_extensions = {'exe', 'bat', 'sh', 'elf', 'msi', 'scr', 'cmd', 'vbs', 'js', 'py'}
        if ext in dangerous_extensions:
            logger.warning(f"[FILE_REJECTED] Filename: '{filename}' | Reason: Dangerous executable extension '.{ext}'")
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
        Mở file zip mã hóa bằng mật khẩu được cấu hình,
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
                        zip_password = settings.MALWARE_ZIP_PASSWORD.encode("utf-8")
                        zf.setpassword(zip_password)
                        # Thử đọc thử file đầu tiên để test pass
                        zf.read(zf.namelist()[0])
                    except Exception:
                        raise HTTPException(
                            status_code=400,
                            detail=(
                                "File zip bị khóa mật khẩu. Theo quy định môn học, "
                                "vui lòng sử dụng mật khẩu "
                                f"'{settings.MALWARE_ZIP_PASSWORD}' để hệ thống tự động quét an toàn."
                            )
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
    def process_and_scan_pdf(filepath: str) -> dict:
        """
        Quét cấu trúc tĩnh của tệp PDF:
        Phát hiện các phần tử rủi ro mã độc cao:
        - /JavaScript hoặc /JS (mã script tự kích hoạt)
        - /Launch (thực thi ứng dụng bên ngoài)
        - /EmbeddedFiles (nhúng payload thực thi bên trong)
        - /OpenAction hoặc /AA (tự động chạy lệnh khi mở tài liệu)
        """
        scan_results = {
            "status": "clean",
            "threats_found": [],
            "scanned": True
        }

        try:
            with open(filepath, "rb") as f:
                content = f.read()

            # Kiểm tra định dạng header PDF
            if not content.startswith(b"%PDF-"):
                scan_results["status"] = "infected"
                scan_results["threats_found"].append("Tệp tin PDF không đúng định dạng chuẩn (%PDF- header missing)")
                return scan_results

            # Các thẻ nguy cơ cao trong PDF thường bị khai thác để nhúng mã độc
            suspicious_patterns = [
                (re.compile(rb"/JavaScript\b", re.IGNORECASE), "Mã JavaScript nhúng (/JavaScript)"),
                (re.compile(rb"/JS\b", re.IGNORECASE), "Mã JavaScript nhúng (/JS)"),
                (re.compile(rb"/Launch\b", re.IGNORECASE), "Lệnh kích hoạt thực thi chương trình ngoài (/Launch)"),
                (re.compile(rb"/EmbeddedFiles\b", re.IGNORECASE), "Tệp tin nhúng ẩn bên trong PDF (/EmbeddedFiles)"),
                (re.compile(rb"/OpenAction\b", re.IGNORECASE), "Hành vi tự động kích hoạt khi mở tài liệu (/OpenAction)"),
                (re.compile(rb"/AA\b", re.IGNORECASE), "Hành vi tự kích hoạt (/AA Additional Action)")
            ]

            for pattern, desc in suspicious_patterns:
                if pattern.search(content):
                    scan_results["status"] = "infected"
                    scan_results["threats_found"].append(desc)

        except Exception as e:
            logger.error(f"Error scanning PDF structure: {str(e)}")
            scan_results["status"] = "infected"
            scan_results["threats_found"].append(f"Lỗi kiểm tra tính hợp lệ của tệp PDF: {str(e)}")

        return scan_results

    @staticmethod
    def process_and_scan_docx(filepath: str) -> dict:
        """
        Quét cấu trúc tệp Word (.docx - bản chất là file nén OpenXML):
        Phát hiện:
        - Tệp chứa Macro độc hại (vbaProject.bin, macro/vba)
        - Tệp nhúng file thực thi nhị phân (.exe, .bat, .dll, .vbs, .ps1)
        """
        scan_results = {
            "status": "clean",
            "threats_found": [],
            "scanned": True
        }

        if not zipfile.is_zipfile(filepath):
            scan_results["status"] = "infected"
            scan_results["threats_found"].append("Tệp Word .docx không hợp lệ (hỏng cấu trúc OpenXML)")
            return scan_results

        try:
            with zipfile.ZipFile(filepath, "r") as zf:
                namelist = zf.namelist()

                for fname in namelist:
                    fname_lower = fname.lower()

                    # Kiểm tra chứa VBA Macro (Docm trá hình hoặc VBA project)
                    if "vbaproject.bin" in fname_lower or fname_lower.endswith(".vba") or "vba" in fname_lower.split('/'):
                        scan_results["status"] = "infected"
                        scan_results["threats_found"].append("Phát hiện mã Macro VBA nhúng trong tài liệu Word (vbaProject.bin)")

                    # Kiểm tra tệp đính kèm / OLE nhúng bên trong
                    file_ext = fname_lower.split('.')[-1] if '.' in fname_lower else ''
                    if file_ext in {'exe', 'bat', 'cmd', 'ps1', 'vbs', 'js', 'scr', 'dll', 'msi', 'pif'}:
                        scan_results["status"] = "infected"
                        scan_results["threats_found"].append(f"Phát hiện file nhị phân độc hại nhúng bên trong Word: {fname}")

        except Exception as e:
            logger.error(f"Error scanning DOCX structure: {str(e)}")
            scan_results["status"] = "infected"
            scan_results["threats_found"].append(f"Lỗi phân tích tệp DOCX: {str(e)}")

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
        
        hasher = hashlib.sha256()
        file_size = 0

        if is_image and ext in {'png', 'jpg', 'jpeg'}:
            # Làm sạch ảnh trước khi lưu
            cleaned_bytes = FileService.sanitize_image(upload_file)
            hasher.update(cleaned_bytes)
            file_size = len(cleaned_bytes)
            with open(filepath, "wb") as f:
                f.write(cleaned_bytes)
        else:
            # Lưu file thông thường
            content = upload_file.file.read()
            hasher.update(content)
            file_size = len(content)
            with open(filepath, "wb") as f:
                f.write(content)
        
        sha256_hash = hasher.hexdigest()

        # Quét bảo mật tự động dựa trên loại tệp
        scan_details = None
        if ext == 'zip':
            scan_details = FileService.process_and_scan_zip(filepath)
        elif ext == 'pdf':
            scan_details = FileService.process_and_scan_pdf(filepath)
        elif ext == 'docx':
            scan_details = FileService.process_and_scan_docx(filepath)

        if scan_details and scan_details.get("status") == "infected":
            # Xóa file ngay lập tức nếu phát hiện nguy cơ độc hại
            try:
                os.remove(filepath)
            except Exception:
                pass
            logger.warning(
                f"[FILE_REJECTED] Filename: '{upload_file.filename}' | SHA256: {sha256_hash} | "
                f"Reason: Security threat detected: {', '.join(scan_details['threats_found'])}"
            )
            raise HTTPException(
                status_code=400,
                detail=f"Từ chối tải lên! Phát hiện nguy cơ bảo mật trong tệp tin: {', '.join(scan_details['threats_found'])}"
            )
                
        return {
            "original_filename": upload_file.filename,
            "saved_filename": safe_filename,
            "filepath": filepath,
            "ext": ext,
            "size_bytes": file_size,
            "sha256": sha256_hash,
            "scan_details": scan_details
        }
