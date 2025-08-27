import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabasejs';

export default function PublicChatRoom({ room = 'main', user }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef(null);

  useEffect(() => {
    supabase.from('public_chat').select('*').eq('room', room).order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []));
    const channel = supabase.channel('public_chat:' + room)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'public_chat', filter: `room=eq.${room}` }, payload => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [room]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage) return;
    await supabase.from('public_chat').insert({ room, user_id: user.id, content: newMessage });
    setNewMessage('');
  }

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="card mt-4">
      <h3 className="font-bold mb-2">Public Chat Room: {room}</h3>
      <div className="h-48 overflow-y-auto bg-[#0e141b] rounded-t-xl p-2">
        {messages.map((msg, i) => (
          <div key={i} className="mb-1">
            <span className="font-bold">{msg.user_id}:</span> {msg.content}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendMessage} className="flex mt-2">
        <input className="input flex-1" value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Type a message..." />
        <button className="btn ml-2" type="submit">Send</button>
      </form>
    </div>
  );
}
