export interface ChatMessage {
  message_id: number;
  sender_id: number;
  receiver_id: number;
  text: string;
  sent_at: string;
  read_status: boolean;
}

export interface ConversationPreview {
  conversation_id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  last_message: string;
  last_message_at: Date;
  unread_count: number;
  listing_info: {
    listing_id: string;
    title: string;
    first_image: string | null;
  } | null;
}

export interface ChatHistoryResponse {
  messages: ChatMessage[];
  next_before_id: number | null;
  next_before_ts: string | null;
}

export const MESSAGES_VIEWING_TYPE = {
  ALL: 'all',
  UNREAD: 'unread'
};
