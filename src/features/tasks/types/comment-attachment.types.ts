export type TaskComment = {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
};

export type TaskAttachment = {
  id: string;
  taskId: string;
  uploadedBy: string;
  fileName: string;
  storagePath: string;
  byteSize: number;
  contentType: string | null;
  createdAt: string;
  uploader: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
};
