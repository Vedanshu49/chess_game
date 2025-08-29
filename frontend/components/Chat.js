import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabasejs';

export default function Chat({ gameId, user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    async function fetchMessages() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profile:profiles(username)')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching messages:', error);
        toast.error('Error fetching messages: ' + error.message);
      } else {
        setMessages(data);
      }
    }

    fetchMessages();

    const handleNewMessage = async (payload) => {
      const newMessage = payload.new;
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', newMessage.user_id)
        .single();

      if (error) {
        console.error('Error fetching profile for new message:', error);
        toast.error('Error fetching profile: ' + error.message);
        newMessage.profile = null;
      } else {
        newMessage.profile = profile;
      }
      setMessages(currentMessages => [...currentMessages, newMessage]);
    };

    const channel = supabase
      .channel(`chat:${gameId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` }, handleNewMessage)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (newMessage.trim() === '') return;

    const { error } = await supabase
      .from('chat_messages')
      .insert({ game_id: gameId, user_id: user.id, message: newMessage });

    if (error) {
      console.error('Error sending message:', error);
      toast.error('Error sending message: ' + error.message);
    } else {
      setNewMessage('');
    }
  };

  return (
    <div className="bg-panel p-4 rounded-md shadow-lg">
      <h3 className="text-lg font-semibold text-text mb-2">Chat</h3>
      <div className="h-48 overflow-y-auto mb-4 p-2 bg-[#222222] rounded-md">
        {messages.map(msg => (
          <div key={msg.id} className="text-sm text-text mb-1">
            <span className="font-semibold text-accent">{msg.profile?.username || 'User'}:</span> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSendMessage} className="flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="input flex-1"
          placeholder="Type a message..."
        />
        <button type="submit" className="btn">Send</button>
      </form>
    </div>
  );
}