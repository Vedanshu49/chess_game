import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import toast from 'react-hot-toast';

export default function FriendRequestButton({ user, player, handleSendRequest }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkStatus() {
      setLoading(true);
      const { data, error } = await supabase
        .from('friends')
        .select('status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${player.id}),and(user_id.eq.${player.id},friend_id.eq.${user.id})`);
      if (!mounted) return;
      if (error) setStatus('error');
      else if (data && data.length > 0) setStatus(data[0].status);
      else setStatus(null);
      setLoading(false);
    }
    checkStatus();
    return () => { mounted = false; };
  }, [user.id, player.id]);

  if (loading) return <span className="text-muted">Checking...</span>;
  if (status === 'accepted') return <span className="text-green-500">Friend</span>;
  if (status === 'pending') return <span className="text-yellow-400">Request Pending</span>;
  if (status === 'declined') return <span className="text-red-500">Declined</span>;
  return <button onClick={() => handleSendRequest(player.id)} className="btn bg-green-600 hover:bg-green-700">Add Friend</button>;
}
