import type { ConversationPreview } from '../types/message';

// Handles updating an existing conversation in-place
export const updateConversationList = (
	prevConversations: ConversationPreview[],
	data: any,
	activeConversationId: number | null
): ConversationPreview[] => {
	const idx = prevConversations.findIndex(c => c.conversation_id === data.conversation_id);
	if (idx !== -1) {
		const updated = [...prevConversations];
		const [updatedConv] = updated.splice(idx, 1);

		return [
			{
				...updatedConv,
				last_message: data.text || data.last_text,
				last_message_at: new Date(data.sent_at),
				unread_count: (activeConversationId === data.conversation_id ? 0 : (updatedConv.unread_count || 0) + 1)
			},
			...updated
		];
	}
	return prevConversations;
};

// Handles adding a new conversation (with optional room join)
export const addNewConversation = (
	prevConversations: ConversationPreview[],
	data: any,
	socket: WebSocket | null
): ConversationPreview[] => {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ cmd: 'join', conversation_id: data.conversation_id }));
		console.log(`Joining new conversation room: ${data.conversation_id}`);
	}

	return [
		{
			conversation_id: data.conversation_id,
			user_id: data.user_id,
			first_name: data.first_name,
			last_name: data.last_name,
			last_message: data.last_text,
			last_message_at: new Date(data.sent_at),
			unread_count: 1,
			listing_info: data.listing_info || null,
		},
		...prevConversations
	];
};

