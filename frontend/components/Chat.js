import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabasejs'

export default function Chat({ gameId, user, disabled }) {
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const chatEndRef = useRef(null)

  // Load messages
  useEffect(() => {
    if (!gameId) return
    
    supabase.from('chat_messages')
      .select(`
        *,
        profiles:user_id (
          username
        )
      `)
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || [])
        setLoading(false)
        scrollToBottom()
      })

    // Subscribe to new messages
    const channel = supabase.channel('chat:' + gameId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `game_id=eq.${gameId}`
      }, payload => {
        supabase.from('profiles')
          .select('username')
          .eq('id', payload.new.user_id)
          .single()
          .then(({ data: profile }) => {
            setMessages(current => [...current, {
              ...payload.new,
              profiles: profile
            }])
            scrollToBottom()
          })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const sendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || !user) return

    const { error } = await supabase.from('chat_messages').insert({
      game_id: gameId,
      user_id: user.id,
      message: newMessage.trim()
    })

    if (!error) {
      setNewMessage('')
    }
  }

  if (loading) return <div className="text-center p-4" aria-live="polite">Loading chat...</div>

  return (
    <div className="flex flex-col h-[400px]" aria-label="Game chat">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0e141b] rounded-t-xl">
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
            aria-live="polite"
          >
            <div className={`
              max-w-[80%] rounded-xl p-2
              ${msg.user_id === user?.id 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-[#233041] rounded-tl-none'}
            `} tabIndex={0}>
              <div className="text-xs opacity-75 mb-1">
                {msg.profiles?.username || 'Unknown'}
              </div>
              <div className="break-words">
                {msg.message}
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="p-2 bg-[#233041] rounded-b-xl">
        <div className="flex gap-2">
          <input
            type="text"
            disabled={disabled}
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder={disabled ? "Game ended" : "Type a message..."}
            className="flex-1 bg-[#0e141b] rounded-lg px-3 py-2"
            aria-label="Type a message"
          />
          <button
            type="submit"
            disabled={disabled || !newMessage.trim()}
            className="btn bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            aria-label="Send message"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}