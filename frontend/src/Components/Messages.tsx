import '../Style/pages/messages.scss';

import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import {
  updateConversationList,
  addNewConversation
} from '../utils/conversationUtils';
import { FixedSizeList } from 'react-window';

import { getFormattedDate, formatMessageDateLabel } from '../utils/date';
import { API_BASE_URL } from '../../config';
import ClickableUsername from './shared/ClickableUsername';

import type { RootState } from '../store/store';
import {
  type ChatMessage,
  type ConversationPreview,
  type ChatHistoryResponse,
  MESSAGES_VIEWING_TYPE
} from '../types/message';

const defaultAvatarIconUrl = "/default-avatar.svg"; // Placeholder for user avatar
const placeholderImageUrl = "/image-placeholder.png"; // Placeholder image for listings
const userReportIconUrl = "/report.svg"; // Placeholder for report user icon
const userDetailIconUrl = "/info.svg"; // Placeholder for user detail icon
const sendMessageIconUrl = "/send-message.svg"; // Placeholder for send message icon
const chatsIconUrl = "/chats.svg";
const previewRowsIconUrl = "/preview-rows.svg";

export const Messages = () => {
  const socket = useSocket();
  const navigate = useNavigate();
  const listRef = useRef<FixedSizeList>(null);
  const listOuterRef = useRef<HTMLDivElement>(null);
  const { token } = useSelector((state: RootState) => state.auth);
  const location = useLocation();
  const newConversationData = location.state?.newConversationWith;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [allConversations, setAllConversations] = useState<
    ConversationPreview[]
  >([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | null
  >(null);
  const [selectedUser, setSelectedUser] = useState<{
    selected_user_id: number;
    first_name: string;
    last_name: string;
  } | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [radioValue, setRadioValue] = useState(MESSAGES_VIEWING_TYPE.ALL);
  const [searchQuery, setSearchQuery] = useState('');

  const numberOfUnreadConversations =
    socket && socket.readyState === WebSocket.OPEN && allConversations
      ? allConversations?.filter(c => c?.unread_count > 0)?.length
      : 0;

  const Separator = () => <span className="separator"></span>;

  const joinRoom = (conversationId: number) => {
    socket?.send(
      JSON.stringify({
        cmd: 'join',
        conversation_id: conversationId
      })
    );
    console.log('Joining room with conversation ID:', conversationId);
  };

  useEffect(() => {
    if (messages.length > 0 && listOuterRef.current) {
      const container = listOuterRef.current;

      const targetScrollTop = (messages.length - 1) * 110;

      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  // Handle new conversation from profile page
  useEffect(() => {
    if (newConversationData && token) {
      // Start a new conversation with the user from profile
      const startNewConversation = async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/chats/send`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              receiver_id: newConversationData.userId,
              text: `Hi ${newConversationData.firstName}! I saw your profile and wanted to connect.`
            })
          });

          if (response.ok) {
            const data = await response.json();
            // The conversation will be added to the list automatically via WebSocket
            console.log('New conversation started:', data);
          }
        } catch (error) {
          console.error('Failed to start new conversation:', error);
        }
      };

      startNewConversation();
    }
  }, [newConversationData, token]);

  const navigateToListing = (listingId: string) => {
    navigate(`/listing/${listingId}`);
  };


  const fetchSelectedChatHistory = async (conversationId: number) => {
    if (!token) {
      console.error('No authentication token found');
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/chats/individual/${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        throw new Error('Failed to load chat history');
      }

      const data: ChatHistoryResponse = await res.json();

      setMessages(data.messages);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }

    if (socket && conversationId !== null) {
      socket?.send(
        JSON.stringify({ cmd: 'read', conversation_id: conversationId })
      );
    }
  };

  const joinAllRooms = (conversations: ConversationPreview[]) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Socket not ready to join rooms');
      return;
    }

    conversations.forEach(conversation => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            cmd: 'join',
            conversation_id: conversation.conversation_id
          })
        );
        console.log(
          `Joining room for conversation ID: ${conversation.conversation_id}`
        );
      } else {
        console.warn('⚠️ Cannot join room. Socket not ready');
      }
    });
  };

  const isUserOnlineInCurrentConversation = () => {
    if (!selectedUser || !activeConversationId) return false;

    return allConversations.some(
      conversation =>
        conversation.conversation_id === activeConversationId &&
        conversation.user_id === selectedUser.selected_user_id
    );
  };

  const fetchSidebarConversations = async () => {
    console.log('Fetching sidebar conversations...');
    const res = await fetch(`${API_BASE_URL}/chats/preview`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const previews = await res.json();
    console.log('Fetched conversation previews:', previews);
    setAllConversations(previews);

    joinAllRooms(previews);
  };

  useEffect(() => {
    if (!socket) return;

    fetchSidebarConversations();
    socket.onopen = () => {
      console.log('Socket connection established');
      if (token) {
        fetchSidebarConversations();
      } else {
        console.error('No authentication token found');
      }
    };
  }, [socket, token, radioValue]);


  const submitMessage = () => {
    if (!messageInput.trim() || activeConversationId === null) return;

    socket?.send(
      JSON.stringify({
        cmd: 'send',
        conversation_id: activeConversationId,
        text: messageInput.trim()
      })
    );

    setMessageInput('');

    if (radioValue === MESSAGES_VIEWING_TYPE.UNREAD) {
      setRadioValue(MESSAGES_VIEWING_TYPE.ALL);
      fetchSidebarConversations();
    }

  };

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = event => {
      const data = JSON.parse(event.data);

      if (data.type === 'chat') {
        if (data.conversation_id === activeConversationId) {
          const newMsg: ChatMessage = {
            message_id: data.message_id,
            sender_id: data.sender_id,
            receiver_id: selectedUser?.selected_user_id || 0,
            text: data.text,
            sent_at: data.sent_at,
            read_status: false,
          };

          setMessages(prev =>
            prev.some(m => m.message_id === data.message_id)
              ? prev
              : [...prev, newMsg]
          );
        }
        setAllConversations(prev =>
          updateConversationList(prev, data, activeConversationId)
        );
      } else if (data.type === 'preview') {
        setAllConversations(prev => {
          const exists = prev.find(
            c => c.conversation_id === data.conversation_id
          );
          return exists
            ? updateConversationList(prev, data, activeConversationId)
            : addNewConversation(prev, data, socket);
        });
      } else if (data.ok) {
        console.log('Socket OK:', data.ok);
      } else if (data.error) {
        console.warn('Socket error:', data.error);
      }
    };

    return () => {
      socket.onmessage = null;
    };
  }, [socket, activeConversationId, selectedUser]);


  const onRadioButtonChange = (value: string) => {
    setActiveConversationId(null);
    setRadioValue(value);
    if (value === MESSAGES_VIEWING_TYPE.ALL) {
      fetchSidebarConversations();
    } else if (value === MESSAGES_VIEWING_TYPE.UNREAD) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      setAllConversations(prev =>
        prev.filter(conversation => conversation.unread_count > 0)
      );
    }
  };
  const filteredConversations =
    socket && socket.readyState === WebSocket.OPEN && allConversations
      ? allConversations
        .filter(convo => {
          if (radioValue === MESSAGES_VIEWING_TYPE.UNREAD)
            return convo.unread_count > 0;
          return true;
        })
        .filter(convo =>
          `${convo.first_name} ${convo.last_name}`
            .toLowerCase()
            .includes(searchQuery.toLowerCase())
        )
      : [];

  return (
    <div className="messages-page">
      <div className="messages-container">
        <div className="messages-general-view">
          <div className="messages-general-view-header">
            <h2 className="messages-general-view-header-text">
              Chats{' '}
              {filteredConversations?.length > 0
                ? `(${filteredConversations?.length})`
                : ''}
            </h2>
          </div>
          <Separator />
          <div className="messages-general-view-radio-container">
            <label className="messages-general-view-radio-item">
              <input
                type="radio"
                name="radio"
                checked={radioValue === MESSAGES_VIEWING_TYPE.ALL}
                onChange={() => onRadioButtonChange(MESSAGES_VIEWING_TYPE.ALL)}
              />
              <span className="name">All</span>
            </label>
            <label className="messages-general-view-radio-item">
              <input
                type="radio"
                name="radio"
                checked={radioValue === MESSAGES_VIEWING_TYPE.UNREAD}
                onChange={() =>
                  onRadioButtonChange(MESSAGES_VIEWING_TYPE.UNREAD)
                }
              />
              <span className="name">
                Unread{' '}
                {numberOfUnreadConversations > 0
                  ? `(${numberOfUnreadConversations})`
                  : ''}
              </span>
            </label>
          </div>
          <div className="messages-general-view-search-container">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="icon">
              <g>
                <path d="M21.53 20.47l-3.66-3.66C19.195 15.24 20 13.214 20 11c0-4.97-4.03-9-9-9s-9 4.03-9 9 4.03 9 9 9c2.215 0 4.24-.804 5.808-2.13l3.66 3.66c.147.146.34.22.53.22s.385-.073.53-.22c.295-.293.295-.767.002-1.06zM3.5 11c0-4.135 3.365-7.5 7.5-7.5s7.5 3.365 7.5 7.5-3.365 7.5-7.5 7.5-7.5-3.365-7.5-7.5z"></path>
              </g>
            </svg>
            <input
              className="input"
              type="search"
              value={searchQuery}
              placeholder="Search by full name"
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div
            className={`messages-general-view-list ${allConversations.length ? 'has-conversation' : ''
              }`}
          >
            {filteredConversations.length === 0 && (
              <div className="messages-general-view-list-empty">
                <img src={previewRowsIconUrl} alt="conversation-rows" />
                {radioValue === MESSAGES_VIEWING_TYPE.UNREAD ? (
                  <p>There is no unread messages.</p>
                ) : (
                  <p>There are no conversations yet.</p>
                )}
              </div>
            )}
            {filteredConversations?.map((conversation, index) => (
              <div
                key={index}
                className={`messages-general-view-list-item ${activeConversationId == conversation?.conversation_id
                  ? 'active-conversation'
                  : ''
                  }`}
                onClick={() => {
                  setActiveConversationId(conversation?.conversation_id);
                  fetchSelectedChatHistory(conversation?.conversation_id);
                  joinRoom(conversation?.conversation_id);
                  setSelectedUser({
                    selected_user_id: conversation.user_id,
                    first_name: conversation.first_name,
                    last_name: conversation.last_name
                  });
                  setAllConversations(prev =>
                    prev.map(c =>
                      c.conversation_id === conversation.conversation_id
                        ? { ...c, unread_count: 0 }
                        : c
                    )
                  );
                }}
              >
                {conversation?.unread_count > 0 &&
                  activeConversationId !== conversation?.conversation_id && (
                    <div className="messages-general-view-list-item-unread-count">
                      <span className="messages-general-view-list-item-unread-count-number">
                        {conversation?.unread_count}
                      </span>
                    </div>
                  )}
                <div className="messages-general-view-list-item-image">
                  <img src={defaultAvatarIconUrl} alt="User" />
                  <span
                    className={`messages-general-view-list-item-online-status ${isUserOnlineInCurrentConversation() ? 'online' : 'offline'
                      }`}
                  ></span>
                </div>
                <div className="messages-general-view-list-item-content">
                  <h3 className="messages-general-view-list-item-name">
                    <ClickableUsername
                      className="messages-general-view-list-item-name-link"
                      userId={conversation.user_id}
                      firstName={conversation.first_name}
                      lastName={conversation.last_name}
                    />
                  </h3>
                  <p>{conversation.last_message}</p>
                  <p className="messages-general-view-list-item-date">
                    {getFormattedDate(new Date(conversation.last_message_at))}
                  </p>
                </div>
                <div className="messages-general-view-list-item-preview-image"
                  onClick={() => {
                    if (conversation?.listing_info) {
                      navigateToListing(conversation.listing_info.listing_id);
                    }
                  }
                  }
                >
                  <img src={
                    conversation?.listing_info?.first_image
                      ? conversation.listing_info.first_image
                      : placeholderImageUrl
                  } alt="Preview Image" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="messages-selected-view">
          {activeConversationId === null ? (
            <div className="messages-selected-view-empty">
              <img src={chatsIconUrl} alt="Messaging Icon" />
              <p>Select a conversation to view messages.</p>
            </div>
          ) : (
            <>
              <div className="messages-selected-view-header">
                <div className="messages-selected-view-header-image">
                  <img
                    src="https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8dXNlcnxlbnwwfHwwfHx8MA%3D%3D"
                    alt="User"
                  />
                </div>
                <div className="messages-selected-view-header-user-info">
                  <h3>
                    {selectedUser && (
                      <ClickableUsername
                        userId={selectedUser.selected_user_id}
                        firstName={selectedUser.first_name}
                        lastName={selectedUser.last_name}
                      />
                    )}
                  </h3>
                  <p className="messages-selected-view-header-status">
                    Active now
                  </p>
                </div>
                <div className="messages-selected-view-header-actions">
                  <div className="messages-selected-view-header-action-button">
                    <img src={userDetailIconUrl} alt="View User" />
                  </div>
                  <div className="messages-selected-view-header-action-button">
                    <img src={userReportIconUrl} alt="Report User" />
                  </div>
                </div>
              </div>
              <Separator />
              <div className="messages-selected-view-chat">
                {allConversations?.length != 0 && (
                  <div className="messages-selected-view-chat-messages-container">
                    <FixedSizeList
                      height={650}
                      itemCount={messages.length}
                      itemSize={100}
                      style={{ overflowY: 'auto', scrollbarWidth: 'none' }}
                      width={'100%'}
                      ref={listRef}
                      outerRef={listOuterRef}
                    >
                      {({ index, style }) => {
                        const message = messages[index];
                        const currentMsgDate = new Date(message.sent_at);
                        const previousMsg = messages[index - 1];
                        const prevMsgDate = previousMsg
                          ? new Date(previousMsg.sent_at)
                          : null;

                        const isNewDay =
                          !prevMsgDate ||
                          currentMsgDate.toDateString() !==
                          prevMsgDate.toDateString();

                        return (
                          <div style={style}>
                            {isNewDay && (
                              <div className="day-separator">
                                <span>
                                  {formatMessageDateLabel(message.sent_at)}
                                </span>
                              </div>
                            )}
                            <div
                              className={`messages-selected-view-chat-message ${message.sender_id !==
                                selectedUser?.selected_user_id
                                ? 'sent'
                                : 'received'
                                }`}
                            >
                              <div className="messages-selected-view-chat-message-item">
                                <div className="messages-selected-view-chat-message-image">
                                  <img
                                    src={defaultAvatarIconUrl}
                                    alt="User image"
                                  />
                                </div>
                                <div className="messages-selected-view-chat-message-content">
                                  <p className="messages-selected-view-chat-message-text">
                                    {message.text}
                                  </p>
                                </div>
                              </div>
                              <p className="messages-selected-view-chat-message-date">
                                {getFormattedDate(new Date(message.sent_at))}
                              </p>
                            </div>
                          </div>
                        );
                      }}
                    </FixedSizeList>
                  </div>
                )}

                <div className="messages-selected-view-chat-input-container">
                  <input
                    type="text"
                    placeholder="Type your message..."
                    className="messages-selected-view-chat-input"
                    value={messageInput}
                    onChange={e => setMessageInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && messageInput.trim()) {
                        submitMessage();
                        setMessageInput('');
                      }
                    }}
                  />
                  <button
                    className="messages-selected-view-chat-send-button"
                    onClick={() => {
                      if (messageInput.trim()) {
                        submitMessage();
                        setMessageInput('');
                      }
                    }}
                  >
                    <img src={sendMessageIconUrl} alt="Send Message" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
