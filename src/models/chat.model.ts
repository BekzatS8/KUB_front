export interface MemberStatus {
    user_id: number;
    is_online: boolean;
    last_seen: string;
}

export interface Chat {
    id: number;
    name: string;
    is_group: boolean;
    members: number[];
    member_statuses: MemberStatus[];
    last_message_text: string;
    last_message_at: string;
    online: boolean;
    unread_count: number;
    created_at: string;
}

export interface Message {
    id: number;
    chat_id: number;
    sender_id: number;
    text: string;
    attachments: string[];
    is_read?: boolean;
    created_at: string;
}

export type CreatePersonalChatRequest = {
    user_id: number;
};

export type CreateGroupChatRequest = {
    name: string;
    members: number[];
};

export type AddMembersRequest = {
    members: number[];
};

export type SendMessageRequest = {
    text: string;
    attachments: string[];
};