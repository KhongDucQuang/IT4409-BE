// src/api/labels.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

// ==========================================
// 1. API QUAN TRỌNG NHẤT: TOGGLE LABEL
// ==========================================
router.put('/toggle', async (req, res) => {
  const { cardId, boardId, color, name = '' } = req.body;
  // const userId = req.user!.id; // Nếu muốn check quyền Member thì dùng userId

  try {
    // BƯỚC 1: Tìm xem Board này đã có Label màu này chưa?
    // Nếu chưa có thì tạo mới (Find First or Create)
    let label = await prisma.label.findFirst({
      where: { 
        boardId: boardId, 
        color: color 
      }
    });

    if (!label) {
      label = await prisma.label.create({
        data: {
          boardId,
          color,
          name: name || '', // Tên mặc định rỗng nếu không truyền
        }
      });
    }

    // BƯỚC 2: Kiểm tra xem Card đã gắn Label này chưa (Check bảng trung gian)
    const existingRelation = await prisma.labelsOnCards.findUnique({
      where: {
        cardId_labelId: {
          cardId: cardId,
          labelId: label.id
        }
      }
    });

    if (existingRelation) {
      // CÓ RỒI -> GỠ RA (Delete)
      await prisma.labelsOnCards.delete({
        where: {
          cardId_labelId: {
            cardId: cardId,
            labelId: label.id
          }
        }
      });
    } else {
      // CHƯA CÓ -> GẮN VÀO (Create)
      await prisma.labelsOnCards.create({
        data: {
          cardId: cardId,
          labelId: label.id
        }
      });
    }

    // BƯỚC 3: Trả về Card mới nhất kèm danh sách Labels
    const updatedCard = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        // Quan trọng: Include sâu để lấy thông tin màu
        labels: {
          include: {
            label: true 
          }
        },
        // Giữ lại các include khác cần thiết cho UI
        assignees: { include: { user: true } }, 
        attachments: true,
        comments: true
      }
    });

    res.json(updatedCard);

  } catch (error) {
    console.error("Lỗi toggle label:", error);
    res.status(500).json({ message: 'Lỗi xử lý nhãn' });
  }
});


// ==========================================
// 2. CÁC API CŨ CỦA BẠN (GIỮ NGUYÊN)
// ==========================================

// Middleware helper kiểm tra quyền
const checkLabelPermission = async (req: any, res: any, next: any) => {
  const { labelId } = req.params;
  // const userId = req.user!.id; // Giả sử đã có middleware auth gán req.user

  try {
    const label = await prisma.label.findUnique({ where: { id: labelId } });
    if (!label) return res.status(404).json({ message: 'Không tìm thấy nhãn' });

    // (Tạm bỏ qua check member để test cho nhanh, bạn có thể uncomment lại)
    /*
    const membership = await prisma.boardMember.findUnique({
      where: { boardId_userId: { boardId: label.boardId, userId } },
    });
    if (!membership) return res.status(403).json({ message: 'Không có quyền' });
    */

    (req as any).boardId = label.boardId;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
};

// PATCH: Sửa tên/màu label
router.patch('/:labelId', checkLabelPermission, async (req, res) => {
  const { labelId } = req.params;
  const { name, color } = req.body;

  try {
    const updatedLabel = await prisma.label.update({
      where: { id: labelId },
      data: {
        ...(name && { name }),
        ...(color && { color }),
      },
    });
    res.json(updatedLabel);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật nhãn' });
  }
});

// DELETE: Xóa label (Xóa hẳn khỏi board)
router.delete('/:labelId', checkLabelPermission, async (req, res) => {
  const { labelId } = req.params;
  try {
    await prisma.label.delete({ where: { id: labelId } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: 'Lỗi xóa nhãn' });
  }
});

export default router;