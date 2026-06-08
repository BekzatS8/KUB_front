"use client";

import type React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  MessageCircle,
  Send,
  MoreVertical,
  Search,
  Plus,
  Paperclip,
  Smile,
  Users,
  User as UserIcon,
  Trash2,
  LogOut,
  UserPlus,
  MessageSquare,
  Mail,
  Phone,
  Building2,
  FileText,
  CheckCircle,
  Calendar,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ru } from "date-fns/locale";
import {
  getChats,
  getMessages,
  sendMessage,
  uploadAttachment,
  createPersonalChat,
  createGroupChat,
  addMembers,
  leaveChat,
  deleteChat,
} from "@/src/api/chat.api";
import type { Chat, Message } from "@/src/models/chat.model";
import { getCurrentUser } from "@/lib/auth";
import { CustomSelect } from "@/components/ui/custom-select";
import api from "@/src/api/index";
import type { User } from "@/src/models/users.model";
import useWebSocket from "@/hooks/useWebSocket";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Check, CheckCheck, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [chats, setChats] = useState<Chat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userCache, setUserCache] = useState<Map<number, any>>(new Map());
  const [senderNames, setSenderNames] = useState<Map<number, string>>(new Map());
  const [previousUserInfo, setPreviousUserInfo] = useState<any>(null); // For back navigation
  const currentUser = getCurrentUser();
  
  // Debug current user
  useEffect(() => {
    console.log('Current user data:', currentUser);
    console.log('Current user ID:', currentUser?.id);
    console.log('Current user type:', typeof currentUser);
    console.log('Current user keys:', currentUser ? Object.keys(currentUser) : 'null');
    
    // Check localStorage directly
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('current_user');
      console.log('Raw user data from localStorage:', userData);
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          console.log('Parsed user data:', parsed);
          console.log('Parsed user ID:', parsed.id);
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // Also check JWT token for user ID
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          console.log('JWT payload:', payload);
          console.log('JWT user ID:', payload.user_id);
        } catch (e) {
          console.error('Error parsing JWT token:', e);
        }
      }
    }
  }, []);

  // Helper function to get current user ID with fallbacks
  const getCurrentUserId = () => {
    if (currentUser?.id) return currentUser.id;
    
    // Try to get from localStorage
    if (typeof window !== 'undefined') {
      const userData = localStorage.getItem('current_user');
      if (userData) {
        try {
          const parsed = JSON.parse(userData);
          if (parsed.id) return parsed.id;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // Try to get from JWT token
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.user_id) return payload.user_id;
        } catch (e) {
          console.error('Error parsing JWT token:', e);
        }
      }
    }
    
    return null;
  };

  const [isCreateChatModalOpen, setIsCreateChatModalOpen] = useState(false);
  const [createPersonalChatUserId, setCreatePersonalChatUserId] = useState<string | null>(null);
  const [createGroupChatName, setCreateGroupChatName] = useState("");
  const [createGroupChatMembers, setCreateGroupChatMembers] = useState<string[]>([]);

  const [isAddMembersModalOpen, setIsAddMembersModalOpen] = useState(false);
  const [addMembersList, setAddMembersList] = useState<string[]>([]);
  const [isChatVisible, setIsChatVisible] = useState(false);
  const [selectedUserInfo, setSelectedUserInfo] = useState<any>(null);
  const [isUserInfoModalOpen, setIsUserInfoModalOpen] = useState(false);

  // Helper function to get user display name for both User and ChatUserDirectoryItem structures
  const getUserDisplayName = (user: any) => {
    if (!user) return "Without name";
    const fullName = (user.full_name || user.fullName || "").trim();
    if (fullName) return fullName;
    const nameParts = [
      user.last_name || user.lastName,
      user.first_name || user.firstName,
      user.middle_name || user.middleName,
    ]
      .map((part) => (part || "").trim())
      .filter(Boolean);
    if (nameParts.length > 0) return nameParts.join(" ");
    // Handle ChatUserDirectoryItem structure (from /chats/users endpoint)
    if (user.display_name) return user.display_name.trim();
    return user.company_name || user.email || "Without name";
  };

  const getUserSearchText = (user: any) => [
    getUserDisplayName(user),
    user?.display_name,
    user?.full_name,
    user?.fullName,
    user?.first_name,
    user?.firstName,
    user?.last_name,
    user?.lastName,
    user?.middle_name,
    user?.middleName,
  ]
    .map((part) => (part || "").toString().trim())
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const handleNewMessage = useCallback((newMessage: any) => {
    console.log('WebSocket data received:', newMessage);
    
    // Check if this is actually a message, not a status update
    if (!newMessage || typeof newMessage !== 'object') {
      console.log('Invalid WebSocket data, ignoring:', newMessage);
      return;
    }
    
    // Handle different WebSocket message types
    if (newMessage.type === 'unread') {
      console.log('Received unread status update:', newMessage);
      // Update chat unread count
      const chat = (chats || []).find(c => c.id === newMessage.chat_id);
      if (chat) {
        chat.unread_count = newMessage.unread_count || 0;
        setChats([...chats]);
      }
      return;
    }
    
    // Handle actual chat messages
    if (newMessage.text && newMessage.sender_id && newMessage.created_at) {
      console.log('Received actual chat message:', newMessage);
      const currentUserId = getCurrentUserId();
      console.log('Current selected chat ID:', selectedChat?.id);
      console.log('New message chat ID:', newMessage.chat_id);
      console.log('Current messages count:', messages.length);
      console.log('Current user ID for WebSocket:', currentUserId);
      console.log('Message sender ID for WebSocket:', newMessage.sender_id);
      
      if (newMessage.chat_id === selectedChat?.id) {
        console.log('Adding message to current chat');
        setMessages(prevMessages => {
          // Check if message already exists to prevent duplicates
          const messageExists = prevMessages.some(msg => msg.id === newMessage.id);
          if (messageExists) {
            console.log('Message already exists, not adding duplicate:', newMessage.id);
            return prevMessages;
          }
          const updated = [...prevMessages, newMessage];
          console.log('Messages updated after WebSocket:', updated);
          return updated;
        });
      } else {
        console.log('Message is for different chat, not adding to messages');
      }
      
      // Update chat last message info
      const chat = (chats || []).find(c => c.id === newMessage.chat_id);
      if (chat) {
        chat.last_message_text = newMessage.text;
        chat.last_message_at = newMessage.created_at;
        if (newMessage?.sender_id?.toString() !== currentUserId?.toString()) {
          chat.unread_count++;
        }
        setChats([...chats]);
      }
    } else {
      console.log('Received unknown WebSocket data type:', newMessage);
    }
  }, [selectedChat, chats, messages.length]);

  useWebSocket(selectedChat?.id ?? null, handleNewMessage);


  useEffect(() => {
    fetchChats();
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setUsersLoading(true);
    try {
      const res = await api.get('/chats/users', { params: { limit: 100 } });
      const usersData = res.data?.value || res.data || [];
      const usersArray = Array.isArray(usersData) ? usersData : [];
      setUsers(usersArray);
      
      // Cache the users
      const cache = new Map<number, any>();
      usersArray.forEach(user => {
        const userId = user?.user_id || user?.id;
        if (userId) {
          cache.set(Number(userId), user);
        }
      });
      setUserCache(cache);
    } catch (e: any) {
      console.error('Error loading chat users:', e);
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }

  async function fetchUserById(userId: number): Promise<any | null> {
    // Check cache first
    if (userCache.has(userId)) {
      return userCache.get(userId);
    }

    try {
      const res = await api.get(`/users/${userId}`);
      const userData = res.data;
      
      if (userData) {
        // Cache the user
        setUserCache(prev => {
          const newCache = new Map(prev);
          newCache.set(userId, userData);
          return newCache;
        });
        return userData;
      }
    } catch (e: any) {
      console.error(`Error fetching user ${userId}:`, e);
    }

    return null;
  }

  // Function to get sender name with cache support
  const getSenderName = async (senderId: number): Promise<string> => {
    // First check the cache
    if (userCache.has(senderId)) {
      const user = userCache.get(senderId);
      return getUserDisplayName(user);
    }

    // Check the users array
    const user = users.find(u => (u?.user_id || u?.id)?.toString() === senderId.toString());
    if (user) {
      return getUserDisplayName(user);
    }

    // Fetch user details if not found
    const fetchedUser = await fetchUserById(senderId);
    if (fetchedUser) {
      return getUserDisplayName(fetchedUser);
    }

    // Final fallback
    return `User ${senderId}`;
  };

  async function fetchChats() {
    setChatsLoading(true);
    setChatsError(null);
    try {
      const res = await getChats();
      setChats(res);
    } catch (e: any) {
      console.error(e);
      setChatsError(e.message || "Не удалось загрузить чаты");
    } finally {
      setChatsLoading(false);
    }
  }

  useEffect(() => {
    console.log('useEffect triggered for selectedChat:', selectedChat);
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    } else {
      console.log('No selected chat, clearing messages');
      setMessages([]);
    }
  }, [selectedChat]);

  // Load sender names when messages change
  useEffect(() => {
    const loadSenderNames = async () => {
      const newSenderNames = new Map<number, string>();
      
      for (const message of messages) {
        if (message.sender_id && !newSenderNames.has(message.sender_id)) {
          const senderName = await getSenderName(message.sender_id);
          newSenderNames.set(message.sender_id, senderName);
        }
      }
      
      setSenderNames(newSenderNames);
    };

    if (messages.length > 0) {
      loadSenderNames();
    }
  }, [messages, userCache]);

  async function fetchMessages(chatId: number) {
    console.log('Fetching messages for chat:', chatId);
    setMessagesLoading(true);
    setMessagesError(null);
    try {
      const res = await getMessages(chatId, 50, 0);
      console.log('Raw API response:', res);
      console.log('Response type:', typeof res);
      console.log('Is array:', Array.isArray(res));
      
      // Handle different API response formats
      let messagesArray: any[] = [];
      
      if (Array.isArray(res)) {
        // Direct array response
        messagesArray = res;
      } else if (res && (res as any).value && Array.isArray((res as any).value)) {
        // Response with .value property (like {Count: 17, value: Array(17)})
        messagesArray = (res as any).value;
        console.log('Extracted messages from response.value:', messagesArray.length);
      } else if (res && (res as any).data && Array.isArray((res as any).data)) {
        // Response with .data property
        messagesArray = (res as any).data;
        console.log('Extracted messages from response.data:', messagesArray.length);
      } else {
        console.log('Unexpected response format, trying to extract messages...');
        // Try to find an array in the response
        const values = Object.values(res || {});
        const arrayValue = values.find((val): val is any[] => Array.isArray(val));
        if (arrayValue) {
          messagesArray = arrayValue;
          console.log('Found messages array in response property:', messagesArray.length);
        }
      }
      
      console.log('Final messages array length:', messagesArray.length);
      
      // Log each message details
      messagesArray.forEach((msg: any, index: number) => {
        console.log(`Message ${index}:`, {
          id: msg.id,
          text: msg.text,
          created_at: msg.created_at,
          sender_id: msg.sender_id,
          chat_id: msg.chat_id
        });
      });
      
      // Deduplicate messages by ID
      const uniqueMessages = messagesArray.filter((message: any, index: number, self: any[]) =>
        index === self.findIndex((m) => m.id === message.id)
      );
      
      if (uniqueMessages.length !== messagesArray.length) {
        console.log(`Deduplicated ${messagesArray.length - uniqueMessages.length} duplicate messages`);
      }
      
      console.log('Setting unique messages:', uniqueMessages);
      setMessages(uniqueMessages);

      // Mark messages as read
      const chat = chats.find(c => c.id === chatId);
      if (chat && chat.unread_count > 0) {
        // Optimistic update
        chat.unread_count = 0;
        setChats([...chats]);

        // API call
        try {
          const { markAsRead } = await import("@/src/api/chat.api");
          await markAsRead(chatId);
        } catch (err) {
          console.error("Failed to mark messages as read", err);
        }
      }
    } catch (e: any) {
      console.error('Error fetching messages:', e);
      console.error('Error details:', {
        message: e.message,
        status: e.response?.status,
        data: e.response?.data
      });
      setMessagesError(e.message || "Не удалось загрузить сообщения");
    } finally {
      setMessagesLoading(false);
    }
  }

  const handleSendMessage = async (text: string, attachments: string[] = []) => {
    if (!text.trim() || !selectedChat) return;

    console.log('Sending message:', { text, attachments, chatId: selectedChat.id });

    try {
      const response = await sendMessage(selectedChat.id, { text, attachments });
      console.log('Message sent successfully:', response);
      console.log('Response details:', {
        id: response.id,
        text: response.text,
        created_at: response.created_at,
        chat_id: response.chat_id
      });
      
      // Check if the response has a valid ID (indicates it was saved)
      if (!response.id) {
        console.error('Message response missing ID - may not have been saved to database');
      }
      
      // Immediately add the message to local state to show it right away
      setMessages(prevMessages => {
        // Check if message already exists to prevent duplicates
        const messageExists = prevMessages.some(msg => msg.id === response.id);
        if (messageExists) {
          console.log('Message already exists in local state, not adding duplicate:', response.id);
          return prevMessages;
        }
        const newMessages = [...prevMessages, response];
        console.log('Messages updated after sending:', newMessages);
        return newMessages;
      });
      
      setMessage("");
    } catch (e: any) {
      console.error('Error sending message:', e);
      console.error('Send error details:', {
        message: e.message,
        status: e.response?.status,
        data: e.response?.data
      });
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!selectedChat) return;
    try {
      const { url } = await uploadAttachment(selectedChat.id, file);
      await handleSendMessage(file.name, [url]);
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleCreatePersonalChat = async () => {
    if (!createPersonalChatUserId) return;

    // Check if chat already exists
    const existingChat = (chats || []).find(c =>
      !c.is_group &&
      c.members?.includes(parseInt(createPersonalChatUserId)) &&
      c.members?.length === 2
    );

    if (existingChat) {
      setSelectedChat(existingChat);
      setIsChatVisible(true);
      setIsCreateChatModalOpen(false);
      return;
    }

    try {
      await createPersonalChat({ user_id: parseInt(createPersonalChatUserId) });
      await fetchChats();
      setIsCreateChatModalOpen(false);
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleCreateGroupChat = async () => {
    if (!createGroupChatName.trim() || createGroupChatMembers.length === 0) return;
    try {
      await createGroupChat({ name: createGroupChatName, members: createGroupChatMembers.map(id => parseInt(id)) });
      await fetchChats();
      setIsCreateChatModalOpen(false);
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleAddMembers = async () => {
    if (!selectedChat || addMembersList.length === 0) return;
    try {
      await addMembers(selectedChat.id, { members: addMembersList.map(id => parseInt(id)) });
      await fetchChats();
      setIsAddMembersModalOpen(false);
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleLeaveChat = async () => {
    if (!selectedChat) return;
    try {
      await leaveChat(selectedChat.id);
      setSelectedChat(null);
      await fetchChats();
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleDeleteChat = async () => {
    if (!selectedChat) return;
    try {
      await deleteChat(selectedChat.id);
      setSelectedChat(null);
      await fetchChats();
    } catch (e: any) {
      console.error(e);
    }
  }

  const handleShowUserInfo = async (chat: Chat) => {
    if (chat.is_group) {
      // For group chats, show group information with participants
      const participants = await fetchGroupParticipants(chat.members || []);
      
      const groupInfo = {
        id: chat.id,
        name: chat.name || `Group ${chat.id}`,
        is_group: true,
        members: chat.members || [],
        member_count: chat.members?.length || 0,
        created_at: chat.created_at,
        description: `${chat.members?.length || 0} participants`,
        type: 'group',
        participants: participants // Add detailed participant information
      };
      setSelectedUserInfo(groupInfo);
      setIsUserInfoModalOpen(true);
      return;
    }
    
    const otherMemberId = chat.members?.find(m => m?.toString() !== currentUser?.id?.toString());
    if (!otherMemberId) return;
    
    const otherUserId = Number(otherMemberId);
    
    // Check cache first
    if (userCache.has(otherUserId)) {
      const user = userCache.get(otherUserId);
      setSelectedUserInfo(user);
      setIsUserInfoModalOpen(true);
      return;
    }

    // Check users array
    const otherUser = users.find(u => (u?.user_id || u?.id)?.toString() === otherMemberId.toString());
    if (otherUser) {
      setSelectedUserInfo(otherUser);
      setIsUserInfoModalOpen(true);
      return;
    }

    // Fetch user if not found
    const fetchedUser = await fetchUserById(otherUserId);
    if (fetchedUser) {
      setSelectedUserInfo(fetchedUser);
      setIsUserInfoModalOpen(true);
    }
  };

  // New function to show user info by sender ID
  const handleShowUserInfoBySenderId = async (senderId: number) => {
    if (senderId.toString() === currentUser?.id?.toString()) return; // Don't show info for current user
    
    // Check cache first
    if (userCache.has(senderId)) {
      const user = userCache.get(senderId);
      setSelectedUserInfo(user);
      setIsUserInfoModalOpen(true);
      return;
    }

    // Check users array
    const user = users.find(u => (u?.user_id || u?.id)?.toString() === senderId.toString());
    if (user) {
      setSelectedUserInfo(user);
      setIsUserInfoModalOpen(true);
      return;
    }

    // Fetch user if not found
    const fetchedUser = await fetchUserById(senderId);
    if (fetchedUser) {
      setSelectedUserInfo(fetchedUser);
      setIsUserInfoModalOpen(true);
    }
  };

  // Function to fetch all group participants' details
  const fetchGroupParticipants = async (memberIds: number[]): Promise<any[]> => {
    const participants = [];
    
    for (const memberId of memberIds) {
      // Check cache first
      if (userCache.has(memberId)) {
        participants.push(userCache.get(memberId));
        continue;
      }

      // Check users array
      const user = users.find(u => (u?.user_id || u?.id)?.toString() === memberId.toString());
      if (user) {
        participants.push(user);
        continue;
      }

      // Fetch user if not found
      const fetchedUser = await fetchUserById(memberId);
      if (fetchedUser) {
        participants.push(fetchedUser);
      }
    }
    
    return participants;
  };

  // Function to handle viewing individual participant from group
  const handleViewParticipant = (participant: any) => {
    setPreviousUserInfo(selectedUserInfo); // Save current group info
    setSelectedUserInfo(participant); // Show participant info
  };

  // Function to go back to previous view (group info)
  const handleBackToGroup = () => {
    if (previousUserInfo) {
      setSelectedUserInfo(previousUserInfo);
      setPreviousUserInfo(null);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return "";
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return "";
      return date.toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "";
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getChatName = (chat: Chat) => {
    if (chat.is_group && chat.name) return chat.name;
    const otherMemberId = chat.members?.find(m => m?.toString() !== currentUser?.id?.toString());

    if (!otherMemberId) return chat.name || "Chat";

    const otherUserId = Number(otherMemberId);
    
    // Check cache first
    if (senderNames.has(otherUserId)) {
      return senderNames.get(otherUserId);
    }

    // Check users array
    const otherUser = users.find(u => (u?.user_id || u?.id)?.toString() === otherMemberId.toString());
    if (otherUser) {
      return getUserDisplayName(otherUser);
    }

    return usersLoading ? "Loading..." : (chat.name || `User ${otherMemberId}`);
  };

  const filteredChats = (chats || []).filter((chat) =>
    getChatName(chat).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const UserSelect = ({
    users,
    value,
    onChange,
    multiple = false,
    placeholder = "Выберите пользователя..."
  }: {
    users: any[],
    value: string | string[],
    onChange: (val: string | string[]) => void,
    multiple?: boolean,
    placeholder?: string
  }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");

    // Use the global getUserDisplayName function

    // Filter users based on search
    const normalizedSearch = search.trim().toLowerCase();
    const filteredUsers = users.filter((user) =>
      getUserSearchText(user).includes(normalizedSearch)
    );

    const handleSelect = (userId: string) => {
      if (multiple) {
        const currentValues = Array.isArray(value) ? value : [];
        const newValues = currentValues.includes(userId)
          ? currentValues.filter((v) => v !== userId)
          : [...currentValues, userId];
        onChange(newValues);
      } else {
        onChange(userId);
        setOpen(false);
      }
    };

    const displayValue = multiple
      ? (Array.isArray(value) && value.length > 0
        ? `${value.length} selected`
        : placeholder)
      : (users.find((u) => (u?.user_id || u?.id)?.toString() === value)
        ? getUserDisplayName(users.find((u) => (u?.user_id || u?.id)?.toString() === value))
        : placeholder);

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between"
          >
            <span className="truncate">{displayValue}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Поиск участника..." onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>Пользователь не найден.</CommandEmpty>
              <CommandGroup>
                {filteredUsers.map((user) => {
                  const userId = (user?.user_id || user?.id)?.toString() || '';
                  const isSelected = multiple
                    ? (Array.isArray(value) && value.includes(userId))
                    : value === userId;
                  return (
                    <CommandItem
                      key={user?.user_id || user?.id || 'unknown'}
                      value={getUserDisplayName(user)}
                      onSelect={() => handleSelect(userId)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {getUserDisplayName(user)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  };

  // Debug function to manually refresh messages
  const debugRefreshMessages = () => {
    console.log('Debug: Manually refreshing messages');
    if (selectedChat) {
      fetchMessages(selectedChat.id);
    } else {
      console.log('No selected chat to refresh messages for');
    }
  };

  // Test function to check message persistence
  const debugTestMessagePersistence = async () => {
    if (!selectedChat) {
      console.log('No selected chat for persistence test');
      return;
    }
    
    console.log('=== MESSAGE PERSISTENCE TEST ===');
    console.log('1. Fetching current messages...');
    
    // Get current messages
    const beforeMessages = await getMessages(selectedChat.id, 50, 0);
    console.log('Messages before test:', beforeMessages?.length || 0);
    
    // Send a test message
    const testText = `Test message ${Date.now()}`;
    console.log('2. Sending test message:', testText);
    
    try {
      const sentMessage = await sendMessage(selectedChat.id, { text: testText, attachments: [] });
      console.log('3. Message sent:', sentMessage);
      
      // Wait a moment then fetch again
      setTimeout(async () => {
        console.log('4. Fetching messages after sending...');
        const afterMessages = await getMessages(selectedChat.id, 50, 0);
        console.log('Messages after test:', afterMessages?.length || 0);
        
        // Check if our test message is in the list
        const foundTestMessage = afterMessages?.find(msg => msg.text === testText);
        console.log('Test message found in database:', !!foundTestMessage);
        
        if (!foundTestMessage) {
          console.error('❌ MESSAGE NOT PERSISTED - Test message not found in database!');
        } else {
          console.log('✅ MESSAGE PERSISTED - Test message found in database');
        }
        console.log('=== END PERSISTENCE TEST ===');
      }, 2000);
      
    } catch (error) {
      console.error('Error in persistence test:', error);
    }
  };

  // Make debug functions available in console
  useEffect(() => {
    (window as any).debugRefreshMessages = debugRefreshMessages;
    (window as any).debugTestMessagePersistence = debugTestMessagePersistence;
    console.log('Debug functions available: debugRefreshMessages(), debugTestMessagePersistence()');
  }, [selectedChat]);

  return (
    <div className="flex h-screen">
      {/* Chat List */}
      <div className={`
        ${isChatVisible ? 'hidden' : 'flex'}
        w-full flex-col bg-white border-r border-gray-200
        md:flex md:w-80
    `}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Чаты</h2>
            <Dialog open={isCreateChatModalOpen} onOpenChange={setIsCreateChatModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {selectedUserInfo?.is_group ? 'Информация о группе' : 'Информация о пользователе'}
                  </DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="personal">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="personal">Личный</TabsTrigger>
                    <TabsTrigger value="group">Групповой</TabsTrigger>
                  </TabsList>
                  <TabsContent value="personal">
                    <div className="py-4">
                      <Label htmlFor="user">Выберите пользователя</Label>
                      <UserSelect
                        users={users.filter(u => (u?.user_id || u?.id)?.toString() !== currentUser?.id)}
                        value={createPersonalChatUserId || ""}
                        onChange={(val) => setCreatePersonalChatUserId(val as string)}
                        placeholder="Поиск..."
                      />
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
                      <Button onClick={handleCreatePersonalChat}>
                        {createPersonalChatUserId && (chats || []).some(c =>
                          !c.is_group &&
                          c.members?.includes(parseInt(createPersonalChatUserId)) &&
                          c.members?.length === 2
                        )
                          ? "Перейти в чат"
                          : "Создать"
                        }
                      </Button>
                    </DialogFooter>
                  </TabsContent>
                  <TabsContent value="group">
                    <div className="py-4 space-y-4">
                      <div>
                        <Label htmlFor="group-name">Название группы</Label>
                        <Input id="group-name" value={createGroupChatName} onChange={e => setCreateGroupChatName(e.target.value)} />
                      </div>
                      <div>
                        <Label>Участники</Label>
                        <div className="space-y-2">
                          {usersLoading ? (
                            <div>Загрузка...</div>
                          ) : (
                            <UserSelect
                              users={users.filter(u => (u?.user_id || u?.id)?.toString() !== currentUser?.id)}
                              value={createGroupChatMembers.map(String)}
                              onChange={(val) => setCreateGroupChatMembers(val as string[])}
                              multiple
                              placeholder="Выберите участников..."
                            />
                          )}
                          {createGroupChatMembers.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {createGroupChatMembers.map(id => {
                                const user = users.find(u => (u?.user_id || u?.id)?.toString() === id);
                                return user ? (
                                  <Badge key={id} variant="secondary" className="flex items-center gap-1">
                                    {getUserDisplayName(user)}
                                    <X
                                      className="h-3 w-3 cursor-pointer hover:text-red-500"
                                      onClick={() => setCreateGroupChatMembers(prev => prev.filter(m => m !== id))}
                                    />
                                  </Badge>
                                ) : null;
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
                      <Button onClick={handleCreateGroupChat}>Создать группу</Button>
                    </DialogFooter>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Поиск чатов..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {chatsLoading && <div className="py-4 text-center">Загрузка чатов...</div>}
            {chatsError && (
              <div className="py-2 text-red-600 text-center">{chatsError}</div>
            )}
            {!chatsLoading && !chatsError && (
              (chats || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center mt-10">
                  <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-gray-500 font-medium">Чатов пока нет</p>
                  <p className="text-sm text-gray-400">Начните свое первое общение!</p>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="p-4 text-center text-gray-500">Чаты не найдены</div>
              ) : (
                filteredChats.map((chat) => (
                  <div
                    key={chat.id}
                    onClick={() => {
                      setSelectedChat(chat);
                      setIsChatVisible(true);
                    }}
                    className={`p-3 rounded-xl cursor-pointer transition-colors ${selectedChat?.id === chat.id
                      ? "bg-blue-50"
                      : "hover:bg-gray-50"
                      }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={''} />
                          <AvatarFallback>
                            {chat.is_group ? <Users className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                          </AvatarFallback>
                        </Avatar>
                        {chat.online && (
                          <div
                            className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500`}
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-sm truncate">
                            {getChatName(chat)}
                          </h3>
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(chat.last_message_at)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600 truncate">
                            {chat.last_message_text || "Нет сообщений"}
                          </p>
                          {chat.unread_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {chat.unread_count}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className={`
        ${isChatVisible ? 'flex' : 'hidden'}
        flex-1 flex-col
        md:flex
    `}>
        {
          selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 bg-white border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsChatVisible(false)}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                    </Button>
                    <div className="relative">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 rounded-full hover:bg-gray-100"
                              onClick={() => handleShowUserInfo(selectedChat)}
                            >
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={''} />
                                <AvatarFallback>
                                  {selectedChat.is_group ? <Users className="h-5 w-5" /> : <UserIcon className="h-5 w-5" />}
                                </AvatarFallback>
                              </Avatar>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{selectedChat.is_group ? 'View group information' : 'View user information'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      {selectedChat.online && (
                        <div
                          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white bg-green-500`}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium">{getChatName(selectedChat)}</h3>
                      <p className="text-sm text-gray-600">
                        {selectedChat.is_group
                          ? `${selectedChat.members?.length || 0} участников`
                          : (() => {
                            const otherMemberId = selectedChat.members?.find(m => m?.toString() !== currentUser?.id?.toString());
                            const status = selectedChat.member_statuses?.find(s => s.user_id === otherMemberId);
                            return status?.is_online ? <span className="text-green-600">В сети</span> : 'Не в сети';
                          })()
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {selectedChat.is_group && <DropdownMenuItem onClick={() => setIsAddMembersModalOpen(true)}><UserPlus className="h-4 w-4 mr-2" />Добавить участников</DropdownMenuItem>}
                        <DropdownMenuItem onClick={handleLeaveChat}><LogOut className="h-4 w-4 mr-2" />Покинуть чат</DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDeleteChat} className="text-red-500"><Trash2 className="h-4 w-4 mr-2" />Удалить чат</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4 bg-gray-50">
                <div className="space-y-4">
                  {(() => {
                    console.log('Rendering messages section:', { messagesLoading, messagesError, messagesLength: messages.length, messages });
                    return null;
                  })()}
                  {messagesLoading && (
                    <div className="py-4 text-center">Загрузка сообщений...</div>
                  )}
                  {messagesError && (
                    <div className="py-2 text-red-600 text-center">{messagesError}</div>
                  )}
                  {!messagesLoading &&
                    !messagesError &&
                    (messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <MessageCircle className="h-12 w-12 text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">Нет сообщений</p>
                        <p className="text-sm text-gray-400">Начните диалог первым сообщением!</p>
                      </div>
                    ) : (
                      messages.reduce((acc: React.ReactNode[], msg, index) => {
                        console.log('Rendering message:', msg, 'index:', index);
                        const currentUserId = getCurrentUserId();
                        const isCurrentUser = msg?.sender_id?.toString() === currentUserId?.toString();
                        console.log('Message alignment check:', {
                          messageSenderId: msg?.sender_id,
                          currentUserId: currentUserId,
                          isCurrentUser,
                          messageText: msg.text?.substring(0, 20)
                        });

                      // Date Separator Logic
                      const messageDate = new Date(msg.created_at);
                      
                      // Skip invalid dates
                      if (isNaN(messageDate.getTime())) {
                        console.warn('Invalid date for message:', msg);
                        return acc;
                      }
                      
                      const prevMessage = index > 0 ? messages[index - 1] : null;
                      const prevMessageDate = prevMessage ? new Date(prevMessage.created_at) : null;

                      let showDateSeparator = false;
                      if (!prevMessageDate ||
                        messageDate.getDate() !== prevMessageDate.getDate() ||
                        messageDate.getMonth() !== prevMessageDate.getMonth() ||
                        messageDate.getFullYear() !== prevMessageDate.getFullYear()) {
                        showDateSeparator = true;
                      }

                      if (showDateSeparator) {
                        let dateLabel = format(messageDate, 'd MMMM yyyy', { locale: ru });
                        if (isToday(messageDate)) dateLabel = "Сегодня";
                        else if (isYesterday(messageDate)) dateLabel = "Вчера";

                        acc.push(
                          <div key={`date-${msg.id}`} className="flex justify-center my-4">
                            <span className="bg-gray-100 text-gray-500 text-xs px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                              {dateLabel}
                            </span>
                          </div>
                        );
                      }

                      // Get sender name from cache
                      const senderName = msg?.sender_id 
                        ? (senderNames.get(msg.sender_id) || `User ${msg.sender_id}`)
                        : "Unknown";
                      
                      console.log('Sender name debug:', {
                        messageSenderId: msg?.sender_id,
                        isCurrentUser,
                        isGroupChat: selectedChat?.is_group,
                        senderName: senderName,
                        selectedChat: selectedChat,
                        senderNamesCache: Array.from(senderNames.entries())
                      });

                      acc.push(
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'} mb-3 w-full`}
                        >
                          {!isCurrentUser && (
                            <button
                              onClick={() => handleShowUserInfoBySenderId(msg.sender_id)}
                              className="text-xs text-muted-foreground ml-2 mb-1 hover:text-blue-600 hover:underline cursor-pointer transition-colors"
                            >
                              {senderName}
                            </button>
                          )}
                          <div
                            className={`max-w-[85%] md:max-w-[70%] px-4 py-2 rounded-2xl shadow-sm relative ${isCurrentUser
                              ? 'bg-blue-600 text-white rounded-tr-none ml-auto'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-none mr-auto'
                              }`}
                          >
                            <p className="whitespace-pre-wrap break-words leading-relaxed text-sm pr-12 pb-1">
                              {msg.text}
                            </p>

                            {/* Attachments */}
                            {msg.attachments && msg.attachments.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((att, index) => (
                                  <a
                                    href={`https://api.kubcrm.kz${att}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    key={index}
                                    className={`block text-xs underline truncate ${isCurrentUser ? "text-blue-100" : "text-blue-500"}`}
                                  >
                                    Вложение {index + 1}
                                  </a>
                                ))}
                              </div>
                            )}

                            <div className="flex justify-end items-center gap-1 absolute bottom-1 right-2">
                              <span className={`text-[10px] ${isCurrentUser ? "text-blue-100 opacity-80" : "text-gray-400"}`}>
                                {(() => {
                                  try {
                                    const msgDate = new Date(msg.created_at);
                                    return isNaN(msgDate.getTime()) ? '' : format(msgDate, 'HH:mm');
                                  } catch (e) {
                                    return '';
                                  }
                                })()}
                              </span>
                              {isCurrentUser && (
                                msg.is_read ? (
                                  <CheckCheck className="h-3 w-3 text-blue-200" />
                                ) : (
                                  <Check className="h-3 w-3 text-blue-200 opacity-70" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                      return acc;
                    }, []))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 bg-white border-t border-gray-200">
                <div className="flex items-center space-x-2">
                  <Input type="file" className="hidden" id="file-upload" onChange={e => e.target.files && handleFileUpload(e.target.files[0])} />
                  <Label htmlFor="file-upload">
                    <Button
                      size="sm"
                      variant="ghost"
                      asChild
                    >
                      <Paperclip className="h-4 w-4" />
                    </Button>
                  </Label>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Введите сообщение..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(message)}
                      className="pr-10"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2"
                    >
                      <Smile className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button onClick={() => handleSendMessage(message)} disabled={!message.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Выберите чат
                </h3>
                <p className="text-gray-600">
                  Выберите чат из списка, чтобы начать общение
                </p>
              </div>
            </div>
          )}
      </div>
      {selectedChat && <Dialog open={isAddMembersModalOpen} onOpenChange={setIsAddMembersModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUserInfo?.is_group ? 'Информация о группе' : 'Информация о пользователе'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label>Участники</Label>
            <div className="space-y-2">
              {usersLoading ? (
                <div>Загрузка...</div>
              ) : (
                users.filter(u => u?.id?.toString() !== currentUser?.id && !selectedChat.members.includes(parseInt(u?.id || 0))).map(user => (
                  <div key={user?.id || 'unknown'} className="flex items-center space-x-2">
                    <Input type="checkbox" id={`add-user-${user?.id}`} onChange={e => {
                      if (e.target.checked) {
                        setAddMembersList([...addMembersList, user?.id || 0]);
                      } else {
                        setAddMembersList(addMembersList.filter(id => id !== user?.id));
                      }
                    }} />
                    <Label htmlFor={`add-user-${user?.id}`}>{user?.firstName} {user?.lastName}</Label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Отмена</Button></DialogClose>
            <Button onClick={handleAddMembers}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {/* User Info Modal */}
      <Dialog open={isUserInfoModalOpen} onOpenChange={setIsUserInfoModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedUserInfo?.is_group ? 'Информация о группе' : 'Информация о пользователе'}
            </DialogTitle>
          </DialogHeader>
          {selectedUserInfo && (
            <div className="space-y-6">
              {/* Avatar and Basic Info */}
              <div className="flex flex-col items-center space-y-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={''} />
                  <AvatarFallback className="text-lg">
                    {selectedUserInfo.is_group ? (
                      <Users className="h-8 w-8" />
                    ) : (
                      (() => {
                        const displayName = getUserDisplayName(selectedUserInfo);
                        const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                        return initials || 'U';
                      })()
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-lg font-semibold">
                    {selectedUserInfo.is_group ? selectedUserInfo.name : getUserDisplayName(selectedUserInfo)}
                  </h3>
                  {selectedUserInfo.is_group ? (
                    <p className="text-sm text-muted-foreground">
                      {selectedUserInfo.member_count} participants
                    </p>
                  ) : (
                    selectedUserInfo.email && (
                      <p className="text-sm text-muted-foreground">{selectedUserInfo.email}</p>
                    )
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {selectedUserInfo.is_group ? 'Group Information' : 'Contact Information'}
                </h4>
                <div className="space-y-3">
                  {selectedUserInfo.is_group ? (
                    <>
                      <div className="flex items-center space-x-3">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedUserInfo.member_count} participants</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Group Chat</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {selectedUserInfo.email && (
                        <div className="flex items-center space-x-3">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedUserInfo.email}</span>
                        </div>
                      )}
                      {selectedUserInfo.phone && (
                        <div className="flex items-center space-x-3">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedUserInfo.phone}</span>
                        </div>
                      )}
                      {selectedUserInfo.company_name && (
                        <div className="flex items-center space-x-3">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{selectedUserInfo.company_name}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Group Participants */}
              {selectedUserInfo.is_group && selectedUserInfo.participants && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">Participants</h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {selectedUserInfo.participants.map((participant: any) => (
                      <div
                        key={participant?.user_id || participant?.id || 'unknown'}
                        className="flex items-center justify-between p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleViewParticipant(participant)}
                      >
                        <div className="flex items-center space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={''} />
                            <AvatarFallback className="text-xs">
                              {(() => {
                                const displayName = getUserDisplayName(participant);
                                const initials = displayName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                                return initials || 'U';
                              })()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{getUserDisplayName(participant)}</p>
                            {participant.email && (
                              <p className="text-xs text-muted-foreground">{participant.email}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {participant.is_online !== undefined && (
                            <div className={`w-2 h-2 rounded-full ${participant.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                          )}
                          {participant.company_name && (
                            <span className="text-xs text-muted-foreground">{participant.company_name}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Additional Information */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  {selectedUserInfo.is_group ? 'Group Details' : 'Additional Information'}
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <UserIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">ID: {selectedUserInfo.id}</span>
                  </div>
                  {selectedUserInfo.is_group ? (
                    <>
                      {selectedUserInfo.created_at && (
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Created: {new Date(selectedUserInfo.created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center space-x-3">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Type: Group Chat</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {selectedUserInfo.bin_iin && (
                        <div className="flex items-center space-x-3">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">BIN/IIN: {selectedUserInfo.bin_iin}</span>
                        </div>
                      )}
                      {selectedUserInfo.is_verified !== undefined && (
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Status: {selectedUserInfo.is_verified ? 'Verified' : 'Not verified'}
                          </span>
                        </div>
                      )}
                      {selectedUserInfo.verified_at && (
                        <div className="flex items-center space-x-3">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            Verified: {new Date(selectedUserInfo.verified_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Status */}
              {!selectedUserInfo.is_group && (
                <div className="flex items-center justify-center">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${selectedUserInfo.is_online ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm text-muted-foreground">
                      {selectedUserInfo.is_online ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Закрыть</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
