// src/api/boards.ts
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  checkBoardMembership,
  checkBoardAdmin,
} from '../middlewares/boardAuth';
import { validate } from '../middlewares/validate';
import { createBoardSchema } from '../schemas/board.schema'; // Đảm bảo bạn đã tạo file này

const prisma = new PrismaClient();
const router = Router();

// GET /api/boards - Lấy tất cả các board của người dùng (ĐÃ PHÂN TRANG)
router.get('/', async (req, res) => {
  const userId = req.user!.id;

  try {
    // 1. Lấy page/limit từ query (ví dụ: ?page=1&limit=20)
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit; // Tính toán số lượng bỏ qua

    // 2. Lấy boards và tổng số board (để tính tổng số trang)
    const [boards, totalBoards] = await prisma.$transaction([
      prisma.board.findMany({
        where: { members: { some: { userId: userId } } },
        orderBy: { createdAt: 'desc' },
        skip: skip,  // <-- Bỏ qua
        take: limit, // <-- Lấy
      }),
      prisma.board.count({
        where: { members: { some: { userId: userId } } },
      }),
    ]);

    // 3. Trả về dữ liệu kèm metadata
    res.json({
      data: boards,
      metadata: {
        totalBoards,
        totalPages: Math.ceil(totalBoards / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi không lấy được danh sách board' });
  }
});

// POST /api/boards - Tạo một board mới
router.post('/', validate(createBoardSchema), async (req, res) => {
  const { title } = req.body;
  const userId = req.user!.id;

  try {
    const newBoard = await prisma.board.create({
      data: {
        title,
        members: {
          create: [
            {
              userId: userId,
              role: 'ADMIN',
            },
          ],
        },
      },
    });
    res.status(201).json(newBoard);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi không tạo được board' });
  }
});

// GET /api/boards/:boardId - Lấy thông tin chi tiết của một board
router.get('/:boardId', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;
  const { labelId, assigneeId } = req.query;

  try {
    const cardFilter: any = {};
    if (labelId) {
      cardFilter.labels = { some: { labelId: labelId as string } };
    }
    if (assigneeId) {
      cardFilter.assignees = { some: { userId: assigneeId as string } };
    }

    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        labels: true,
        lists: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              where: cardFilter,
              orderBy: { position: 'asc' },
              include: {
                labels: { include: { label: true } },
                assignees: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                comments: {
                  include: { user: { select: { id: true, name: true, avatarUrl: true } } },
                  orderBy: { createdAt: 'asc' }
                },
                attachments: true,
                checklists: {
                  orderBy: { position: 'asc' },
                  include: {
                    items: {
                      orderBy: { position: 'asc' }
                    }
                  }
                }
              },
            },
          },
        },
        // **ĐÃ XÓA 'ACTIVITIES' KHỎI ĐÂY**
        // Chúng ta sẽ dùng API phân trang riêng ở dưới
      },
    });

    if (!board) {
      return res.status(404).json({ message: 'Không tìm thấy board' });
    }

    res.json(board);
  } catch (error) {
    console.error(error); // Log lỗi chi tiết
    res.status(500).json({ message: 'Lỗi không tìm thấy board' });
  }
});

// PATCH /api/boards/:boardId - Cập nhật (đổi tên, đổi hình nền)
router.patch('/:boardId', [checkBoardMembership, checkBoardAdmin], async (req, res) => {
  const { boardId } = req.params;
  const { title, backgroundImageUrl } = req.body;

  // Sửa logic: Cho phép cập nhật chỉ title, chỉ background, hoặc cả hai
  const dataToUpdate: any = {};
  if (title !== undefined) {
    dataToUpdate.title = title;
  }
  if (backgroundImageUrl !== undefined) {
    dataToUpdate.backgroundImageUrl = backgroundImageUrl;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    return res.status(400).json({ message: 'Cần cung cấp Tiêu đề (title) hoặc Hình nền (backgroundImageUrl)' });
  }

  try {
    const updatedBoard = await prisma.board.update({
      where: {
        id: boardId,
      },
      data: dataToUpdate, // Sử dụng data đã lọc
    });
    res.json(updatedBoard);
  } catch (error) {
    res.status(404).json({ message: 'Không tìm thấy board' });
  }
});

// DELETE /api/boards/:boardId - Xóa board
router.delete('/:boardId', [checkBoardMembership, checkBoardAdmin], async (req, res) => {
  const { boardId } = req.params;

  try {
    await prisma.board.delete({
      where: {
        id: boardId,
      },
    });
    res.status(204).send();
  } catch (error) {
    res.status(404).json({ message: 'Không tìm thấy board' });
  }
});

// Mời user vào board
// Chỉ cần thay thế route POST /:boardId/members trong file api/boards.ts

// Mời user vào board
// Chỉ cần thay thế route POST /:boardId/members trong file api/boards.ts

// Mời user vào board
// Chỉ cần thay thế route POST /:boardId/members trong file api/boards.ts

// Mời user vào board
router.post('/:boardId/members', [checkBoardMembership, checkBoardAdmin], async (req, res) => {
  const { boardId } = req.params;
  const { email } = req.body;
  const senderId = req.user!.id; // User A đang mời

  if (!email) {
    return res.status(400).json({ message: 'Email là bắt buộc' });
  }

  try {
    const userToInvite = await prisma.user.findUnique({ where: { email } });
    if (!userToInvite) {
      return res.status(404).json({ message: 'Không tìm thấy người dùng này' });
    }
    
    // Kiểm tra xem user có phải chính mình không
    if (userToInvite.id === senderId) {
      return res.status(400).json({ message: 'Bạn không thể tự mời chính mình' });
    }

    // Lấy thông tin board và sender
    const [board, sender] = await Promise.all([
      prisma.board.findUnique({ where: { id: boardId } }),
      prisma.user.findUnique({ where: { id: senderId } })
    ]);

    if (!board || !sender) {
      return res.status(404).json({ message: 'Không tìm thấy board hoặc người gửi' });
    }

    // Tạo member mới
    const newMember = await prisma.boardMember.create({
      data: {
        boardId,
        userId: userToInvite.id,
        role: 'MEMBER',
      },
    });

    // 🔥 TẠO NOTIFICATION TRONG DATABASE
    const notification = await prisma.notification.create({
      data: {
        content: `${sender.name} đã mời bạn vào board "${board.title}"`,
        recipientId: userToInvite.id,
        senderId: senderId,
        boardId: boardId,
        isRead: false,
      },
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        board: { select: { id: true, title: true } },
      }
    });

    // 🚀 GỬI THÔNG BÁO QUA SOCKET REAL-TIME (Không block response)
    try {
      const io = req.app.get('socketio');
      if (io) {
        io.to(userToInvite.id).emit('BE_NEW_NOTIFICATION', {
          notification: notification,
          recipientId: userToInvite.id
        });
        console.log(`✅ Đã gửi notification socket tới user: ${userToInvite.id}`);
      }
    } catch (socketError) {
      // Log lỗi socket nhưng không fail request
      console.error('⚠️ Lỗi gửi socket notification:', socketError);
    }

    // Trả về response thành công
    return res.status(201).json({
      member: newMember,
      notification: notification
    });
  } catch (e: any) {
    console.error('Lỗi mời user:', e);
    // Kiểm tra lỗi unique constraint
    if (e.code === 'P2002') {
      return res.status(409).json({ message: 'Người dùng đã ở trong board' });
    }
    res.status(500).json({ message: 'Lỗi mời người dùng vào board' });
  }
});
// === API CHO LABELS ===

// POST /api/boards/:boardId/labels - Tạo label mới cho board
router.post('/:boardId/labels', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;
  const { name, color } = req.body;

  if (!name || !color) {
    return res.status(400).json({ message: 'Tên và màu sắc là bắt buộc' });
  }

  try {
    const newLabel = await prisma.label.create({
      data: {
        name,
        color,
        boardId,
      },
    });
    res.status(201).json(newLabel);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tạo nhãn' });
  }
});

// GET /api/boards/:boardId/labels - Lấy danh sách label của board
router.get('/:boardId/labels', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;

  try {
    const labels = await prisma.label.findMany({
      where: { boardId },
    });
    res.json(labels);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy danh sách nhãn' });
  }
});

// GET /api/boards/:boardId/search - Tìm kiếm card
router.get('/:boardId/search', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;
  const { q } = req.query;

  if (!q) {
    return res.status(400).json({ message: "Search query 'q' là bắt buộc" });
  }

  try {
    const cards = await prisma.card.findMany({
      where: {
        boardId: boardId,
        OR: [
          { title: { contains: q as string, mode: 'insensitive' } },
          { description: { contains: q as string, mode: 'insensitive' } },
        ],
      },
      include: {
        list: { select: { title: true } }
      }
    });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ message: 'Lỗi tìm kiếm' });
  }
});


// GET /api/boards/:boardId/activities - Lấy lịch sử hoạt động (PHÂN TRANG)
router.get('/:boardId/activities', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;

  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [activities, totalActivities] = await prisma.$transaction([
      prisma.activity.findMany({
        where: { boardId },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, avatarUrl: true } },
        },
        skip: skip,
        take: limit,
      }),
      prisma.activity.count({
        where: { boardId },
      }),
    ]);

    res.json({
      data: activities,
      metadata: {
        totalActivities,
        totalPages: Math.ceil(totalActivities / limit),
        currentPage: page,
        limit,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi lấy lịch sử hoạt động' });
  }
});

// PUT /api/boards/:boardId/move_list - Cập nhật thứ tự các List trong Board
router.put('/:boardId/move_list', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;
  const { listOrderIds } = req.body; // Mảng chứa ID các list theo thứ tự mới: ["id1", "id3", "id2"]

  if (!listOrderIds || !Array.isArray(listOrderIds)) {
    return res.status(400).json({ message: 'listOrderIds phải là một mảng ID' });
  }

  try {
    // Dùng Transaction để đảm bảo tất cả đều được cập nhật hoặc không cái nào cả
    const updatePromises = listOrderIds.map((listId: string, index: number) => {
      return prisma.list.update({
        where: { 
            id: listId,
            boardId: boardId // Đảm bảo list thuộc về board này
        },
        data: { position: index + 1 }, // Cập nhật position: 1, 2, 3...
      });
    });

    await prisma.$transaction(updatePromises);

    res.status(200).json({ message: 'Cập nhật vị trí danh sách thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi cập nhật vị trí' });
  }
});

// backend/src/api/boards.ts

// ... (API move_list ở trên)

// PUT /api/boards/:boardId/move_card - Cập nhật vị trí Card (Cùng cột hoặc Khác cột)
router.put('/:boardId/move_card', checkBoardMembership, async (req, res) => {
  const { boardId } = req.params;
  const { 
    currentCardId, 
    prevColumnId, 
    prevCardOrderIds, 
    nextColumnId, 
    nextCardOrderIds 
  } = req.body;

  try {
    // 1. Cập nhật cột chứa card (nếu di chuyển sang cột khác)
    if (prevColumnId !== nextColumnId) {
       await prisma.card.update({
         where: { id: currentCardId },
         data: { 
           listId: nextColumnId,
           updatedAt: new Date() // Cập nhật thời gian sửa
         } 
       });
    }

    // 2. Cập nhật lại vị trí (position) cho các card trong cột ĐÍCH (nextColumn)
    // Chúng ta chỉ cần quan tâm cột đích vì cột cũ dù hổng lỗ thì thứ tự position tương đối vẫn đúng
    // Hoặc để chắc ăn, ta cập nhật cả 2 cột.
    
    // Logic tối ưu: Chỉ cập nhật những gì cần thiết.
    // Nhưng để đơn giản và tránh lỗi: Ta sẽ cập nhật lại position cho TOÀN BỘ card trong các cột bị ảnh hưởng.
    
    const updatePromises: any[] = [];

    // Cập nhật cột mới (hoặc cột hiện tại nếu không đổi cột)
    if (nextCardOrderIds && nextCardOrderIds.length > 0) {
        nextCardOrderIds.forEach((cardId: string, index: number) => {
            updatePromises.push(
                prisma.card.update({
                    where: { id: cardId },
                    data: { position: index + 1, listId: nextColumnId }
                })
            );
        });
    }

    // Nếu khác cột, ta cũng nên cập nhật lại cột cũ để position của nó liền mạch (1,2,3...) 
    // tránh việc position nhảy cóc (1, 3, 4) gây khó khăn cho lần sau.
    if (prevColumnId !== nextColumnId && prevCardOrderIds && prevCardOrderIds.length > 0) {
        prevCardOrderIds.forEach((cardId: string, index: number) => {
            updatePromises.push(
                prisma.card.update({
                    where: { id: cardId },
                    data: { position: index + 1, listId: prevColumnId }
                })
            );
        });
    }

    await prisma.$transaction(updatePromises);

    res.status(200).json({ message: 'Cập nhật vị trí thẻ thành công' });
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: 'Lỗi cập nhật vị trí thẻ' });
  }
});

export default router;
