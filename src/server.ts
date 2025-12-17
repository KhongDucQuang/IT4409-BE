import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http'; 
import { Server } from 'socket.io';  

// Import các router đã tạo
import authRouter from './api/auth';
import boardsRouter from './api/boards';
import listsRouter from './api/lists';
import cardsRouter from './api/cards';
import usersRouter from './api/users';
import labelsRouter from './api/labels';
import commentsRouter from './api/comments';
import attachmentsRouter from './api/attachments';
import checklistsRouter from './api/checklists';
import checklistItemsRouter from './api/checklistItems';
import notificationsRouter from './api/notifications';

import { authenticateToken } from './middlewares/auth';

const app = express();

// Tạo HTTP Server từ Express App
const httpServer = createServer(app);

// Cấu hình Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:5173', 
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware CORS cho Express
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// === XỬ LÝ SOCKET.IO ===
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join vào Board (Room) - Khi người dùng xem một board cụ thể
  socket.on('join_board', (boardId) => {
    socket.join(boardId);
    console.log(`[SERVER] User ${socket.id} đã Join Room: ${boardId}`);
  });

  // Join User Room - Để nhận thông báo cá nhân
  socket.on('join_user_room', (userId) => {
    socket.join(userId);
    console.log(`User ${socket.id} joined user room: ${userId}`);
  });

  // Xử lý sự kiện Update Board (Kéo thả, sửa tên, comment...)
  socket.on('FE_UPDATE_BOARD', (data) => {
    const { boardId } = data;
    console.log(`[SERVER] Nhận FE_UPDATE_BOARD từ ${socket.id} -> Room: ${boardId}`);
    socket.to(boardId).emit('BE_RELOAD_BOARD', data);
  });

  socket.on('FE_MOVE_LIST', (data) => {
    const { boardId } = data;
    socket.to(boardId).emit('BE_UPDATE_LIST_ORDER', data);
  });

  socket.on('FE_MOVE_CARD', (data) => {
    const { boardId } = data;
    socket.to(boardId).emit('BE_UPDATE_CARD_ORDER', data);
  });

  socket.on('FE_SEND_NOTIFICATION', (data) => {
    const { recipientId } = data;
    // Gửi riêng cho người nhận
    socket.to(recipientId).emit('BE_NEW_NOTIFICATION', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('socketio', io);

app.use('/api/auth', authRouter);
app.use('/api/boards', authenticateToken, boardsRouter);
app.use('/api/lists', authenticateToken, listsRouter);
app.use('/api/cards', authenticateToken, cardsRouter);
app.use('/api/users', authenticateToken, usersRouter);
app.use('/api/labels', authenticateToken, labelsRouter);
app.use('/api/comments', authenticateToken, commentsRouter);
app.use('/api/attachments', authenticateToken, attachmentsRouter);
app.use('/api/checklists', authenticateToken, checklistsRouter);
app.use('/api/checklistItems', authenticateToken, checklistItemsRouter);
app.use('/api/notifications', authenticateToken, notificationsRouter);

const PORT = process.env.PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});