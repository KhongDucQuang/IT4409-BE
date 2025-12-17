import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Import các router
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

// Tạo HTTP Server
const httpServer = createServer(app);

// --- CẤU HÌNH DANH SÁCH TÊN MIỀN ĐƯỢC PHÉP (WHITELIST) ---
const whitelist = [
  'http://localhost:5173',                // Cho phép chạy Local
  'https://it4409-trello.vercel.app',     // Cho phép Vercel chính
  'https://it4409-trello.vercel.app/'     // (Dự phòng)
];

// 1. Cấu hình Socket.IO với whitelist
const io = new Server(httpServer, {
  cors: {
    origin: whitelist, // Socket.IO nhận mảng whitelist trực tiếp
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// 2. Cấu hình CORS cho Express API
const corsOptions = {
  origin: function (origin: any, callback: any) {
    // Cho phép request từ whitelist HOẶC không có origin (như Postman, server-to-server)
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.error(`Blocked by CORS: ${origin}`); // Log ra để dễ debug nếu lỗi
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// === XỬ LÝ SOCKET.IO ===
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_board', (boardId) => {
    socket.join(boardId);
    console.log(`[SERVER] User ${socket.id} đã Join Room: ${boardId}`);
  });

  socket.on('join_user_room', (userId) => {
    socket.join(userId);
    console.log(`User ${socket.id} joined user room: ${userId}`);
  });

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
    socket.to(recipientId).emit('BE_NEW_NOTIFICATION', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.set('socketio', io);

// Routes
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
  console.log(`Allowed CORS Origins:`, whitelist);
});
