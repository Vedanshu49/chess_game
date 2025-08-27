import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';

export default function FriendSystem({ user }) {
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!user) return;
    // Fetch friends
    supabase.from('friends').select('*').or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
      .then(({ data }) => setFriends(data || []));
    // Fetch friend requests
    supabase.from('friend_requests').select('*').eq('to_user', user.id)
      .then(({ data }) => setRequests(data || []));
  }, [user]);

  async function sendRequest(friendName) {
    // Find user by username
    const { data: users } = await supabase.from('profiles').select('id').ilike('username', `%${friendName}%`);
    if (users && users.length > 0) {
      await supabase.from('friend_requests').insert({ from_user: user.id, to_user: users[0].id });
      alert('Friend request sent!');
    } else {
      alert('User not found');
    }
  }

  async function acceptRequest(requestId, fromUser) {
    await supabase.from('friends').insert({ user_id: user.id, friend_id: fromUser });
    await supabase.from('friend_requests').delete().eq('id', requestId);
    setRequests(requests.filter(r => r.id !== requestId));
  }

  return (
    <div className="card mt-4">
      <h3 className="font-bold mb-2">Friends</h3>
      <ul>
        {friends.map(f => <li key={f.id}>{f.user_id === user.id ? f.friend_id : f.user_id}</li>)}
      </ul>
      <h4 className="font-bold mt-2">Add Friend</h4>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Username" className="input" />
      <button className="btn ml-2" onClick={() => sendRequest(search)}>Send Request</button>
      <h4 className="font-bold mt-2">Requests</h4>
      <ul>
        {requests.map(r => (
          <li key={r.id}>
            From: {r.from_user}
            <button className="btn ml-2" onClick={() => acceptRequest(r.id, r.from_user)}>Accept</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
