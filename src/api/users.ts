// src/api/users.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/auth';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const prisma = new PrismaClient();
const router = Router();

// 1. CẤU HÌNH CLOUDINARY
// Tốt nhất là bạn nên để các key này trong file .env
cloudinary.config({
  cloud_name: 'dxzvwal2a', // Thay bằng tên cloud của bạn
  api_key: '425891238316316',       // Thay bằng API Key
  api_secret: 'z3kX1ctMUiptsbhZVOd3-rP1e18'  // Thay bằng API Secret
});

// 2. CẤU HÌNH MULTER (Để upload lên Cloudinary)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'trello-avatars', // Tên thư mục trên Cloudinary
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif'], // Định dạng cho phép
  } as any, // Type assertion để tránh lỗi type checker
});

const upload = multer({ storage: storage });

// --- CÁC ROUTE ---

// Lấy thông tin profile (Giữ nguyên)
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, bio: true, avatarUrl: true },
    });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy thông tin user' });
  }
});

// Cập nhật profile (Đã sửa để nhận file upload)
// Thêm middleware upload.single('avatar') để xử lý file từ frontend gửi lên
router.patch('/me', authenticateToken, upload.single('avatar'), async (req: any, res) => {
  const userId = req.user!.id;
  
  // Dữ liệu text (name, bio) sẽ nằm trong req.body
  const { name, bio } = req.body;
  
  // Dữ liệu file ảnh (nếu có) sẽ nằm trong req.file
  const file = req.file;

  try {
    // Chuẩn bị dữ liệu để update
    let updateData: any = {
      ...(name && { name }),
      ...(bio !== undefined && { bio }),
    };

    // Nếu người dùng có upload ảnh mới -> Lấy link ảnh từ Cloudinary
    if (file && file.path) {
      updateData.avatarUrl = file.path; 
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: { id: true, email: true, name: true, bio: true, avatarUrl: true },
    });

    res.json(updatedUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi cập nhật profile' });
  }
});

export default router;