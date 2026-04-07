// Shared in-memory storage for development when MongoDB is unavailable
export const inMemoryUsers = new Map();
export const inMemoryLoans = new Map();

// Helper to find user by ID in-memory
export const findUserByIdInMemory = (id) => {
  return Array.from(inMemoryUsers.values()).find((u) => u._id === id);
};

// Helper to find user by phone in-memory
export const findUserByPhoneInMemory = (phone) => {
  return inMemoryUsers.get(phone);
};

// Helper to find user by email in-memory
export const findUserByEmailInMemory = (email) => {
  return Array.from(inMemoryUsers.values()).find((u) => u.email === email);
};
