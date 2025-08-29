import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function FriendsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [challengeModal, setChallengeModal] = useState({ isOpen: false, friendId: null, friendUsername: null });
  const [timeControl, setTimeControl] = useState({ time: 5, increment: 0 });

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      fetchFriends();
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    const subscription = supabase
      .channel('public:friends')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friends' }, payload => {
        fetchFriends();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  async function fetchFriends() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: friendsData, error: friendsError } = await supabase
        .from('friends')
        .select(`
          id,
          friend:friend_id ( id, username ),
          user:user_id ( id, username )
        `)
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
        .eq('status', 'accepted');
      if (friendsError) throw friendsError;
      const friendList = friendsData.map(f => f.user.id === user.id ? f.friend : f.user);
      setFriends(friendList);

      const { data: pendingData, error: pendingError } = await supabase
        .from('friends')
        .select(`
          id,
          user:user_id ( id, username )
        `)
        .eq('friend_id', user.id)
        .eq('status', 'pending');
      if (pendingError) throw pendingError;
      setPendingRequests(pendingData);

      const { data: sentData, error: sentError } = await supabase
        .from('friends')
        .select(`
          id,
          friend:friend_id ( id, username )
        `)
        .eq('user_id', user.id)
        .eq('status', 'pending');
      if (sentError) throw sentError;
      setSentRequests(sentData);
    } catch (error) {
      toast.error('Failed to fetch friends data: ' + error.message);
    } finally {
        // Remove friend logic - must be above return
        const handleRemoveFriend = async (friendId) => {
          if (!user || !friendId) return;
          if (!window.confirm('Are you sure you want to remove this friend?')) return;
          try {
            // Remove both directions of friendship
            const { error } = await supabase
              .from('friends')
              .delete()
              .or(`and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`);
            if (error) throw error;
            toast.success('Friend removed.');
            fetchFriends();
          } catch (error) {
            toast.error('Error removing friend: ' + error.message);
          }
        };
      setLoading(false);
    }
  }

  async function handleSendRequest(e) {
    e.preventDefault();
    if (!username.trim() || !user) return;
    try {
      const { data: friendUser, error: findError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('username', username.trim())
        .single();
      if (findError || !friendUser) throw new Error('User not found.');
      if (friendUser.id === user.id) throw new Error("You can't send a friend request to yourself.");

      // Check for existing requests or friendship
      const { data: existing, error: existError } = await supabase
        .from('friends')
        .select('id, status')
        .or(`and(user_id.eq.${user.id},friend_id.eq.${friendUser.id}),and(user_id.eq.${friendUser.id},friend_id.eq.${user.id})`);
      if (existError) throw existError;
      if (existing && existing.length > 0) {
        const status = existing[0].status;
        if (status === 'pending') throw new Error('Friend request already sent or received.');
        if (status === 'accepted') throw new Error('You are already friends.');
      }

      const { error: insertError } = await supabase.from('friends').insert({
        user_id: user.id,
        friend_id: friendUser.id,
        status: 'pending'
      });
      if (insertError) throw insertError;

      await supabase.functions.invoke('send-email', {
        body: JSON.stringify({
          to: friendUser.email,
          subject: 'New Friend Request',
          body: `You have a new friend request from ${user.email}.`,
        }),
      });
      setUsername('');
      toast.success('Friend request sent!');
      fetchFriends();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleAcceptRequest(id) {
    try {
      const { error } = await supabase
        .from('friends')
        .update({ status: 'accepted' })
        .eq('id', id);
      if (error) throw error;
      toast.success('Friend request accepted!');
      // Notification logic (could be email or in-app)
      fetchFriends();
    } catch (error) {
      toast.error('Error accepting request: ' + error.message);
    }
  }

  async function handleRejectRequest(id) {
    try {
      const { error } = await supabase
        .from('friends')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success('Friend request rejected.');
      // Notification logic (could be email or in-app)
      fetchFriends();
    } catch (error) {
      toast.error('Error rejecting request: ' + error.message);
    }
  }

  async function handleChallenge() {
    if (!user || !challengeModal.friendId) return;
    try {
      const { data: friendProfile, error: friendError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', challengeModal.friendId)
        .single();
      if (friendError) throw friendError;

      const { data, error } = await supabase
        .from('games')
        .insert({
          creator: user.id,
          opponent: challengeModal.friendId,
          status: 'waiting',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          turn: 'white',
          initial_time_seconds: timeControl.time * 60,
          increment_seconds: timeControl.increment,
        })
        .select();
      if (error) throw error;

      await supabase.functions.invoke('send-email', {
        body: JSON.stringify({
          to: friendProfile.email,
          subject: 'New Game Challenge',
          body: `You have a new game challenge from ${user.email} with time control ${timeControl.time}+${timeControl.increment}.`,
        }),
      });
      setChallengeModal({ isOpen: false, friendId: null, friendUsername: null });
      router.push(`/game/${data[0].id}`);
    } catch (error) {
      toast.error('Error creating challenge: ' + error.message);
    }
  }

  if (authLoading) {
    return (
      <PageWithHeader user={user} title="Friends">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Friends">
      {challengeModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-panel p-6 rounded-lg w-full max-w-md text-text">
            <h2 className="text-xl font-bold mb-4">Challenge {challengeModal.friendUsername}</h2>
            <div className="space-y-4">
              <p>Select Time Control:</p>
              <div className="flex flex-wrap gap-2">
                {[ {t:1,i:0}, {t:3,i:2}, {t:5,i:0}, {t:10,i:5} ].map(tc => (
                  <button key={`${tc.t}-${tc.i}`} onClick={() => setTimeControl({ time: tc.t, increment: tc.i })} className={`btn ${timeControl.time === tc.t && timeControl.increment === tc.i ? 'bg-green-600' : 'bg-muted'}`}>
                    {tc.t}+{tc.i}
                  </button>
                ))}
              </div>
              <div className="flex gap-4">
                  <label className="flex-1">
                      Time (mins):
                      <input type="number" value={timeControl.time} onChange={e => setTimeControl(tc => ({...tc, time: parseInt(e.target.value)}))} className="input w-full mt-1" />
                  </label>
                  <label className="flex-1">
                      Increment (secs):
                      <input type="number" value={timeControl.increment} onChange={e => setTimeControl(tc => ({...tc, increment: parseInt(e.target.value)}))} className="input w-full mt-1" />
                  </label>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button onClick={() => setChallengeModal({ isOpen: false, friendId: null, friendUsername: null })} className="btn bg-[#222222]">Cancel</button>
              <button onClick={handleChallenge} className="btn bg-accent">Send Challenge</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 bg-panel p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-3 text-text">Your Friends ({friends.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
          {/* Removed misplaced handleRemoveFriend definition */}
              {friends.map(friend => (
                <li key={friend.id} className="bg-[#222222] p-3 rounded-lg flex justify-between items-center text-text">
                  <span>{friend.username}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setChallengeModal({ isOpen: true, friendId: friend.id, friendUsername: friend.username })} className="btn bg-accent">Challenge</button>
                    <button onClick={() => handleRemoveFriend(friend.id)} className="btn bg-red-600 hover:bg-red-700">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-1 bg-panel p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-3 text-text">Friend Requests ({pendingRequests.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
              {pendingRequests.map(req => (
                <li key={req.id} className="bg-[#222222] p-3 rounded-lg flex justify-between items-center text-text">
                  <span>{req.user.username}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptRequest(req.id)} className="btn bg-green-600 hover:bg-green-700">Accept</button>
                    <button onClick={() => handleRejectRequest(req.id)} className="btn bg-red-600 hover:bg-red-700">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="text-xl font-semibold mb-3 mt-6 text-text">Sent Requests ({sentRequests.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
              {sentRequests.map(req => (
                <li key={req.id} className="bg-[#222222] p-3 rounded-lg flex justify-between items-center text-text">
                  <span>{req.friend.username}</span>
                  <span className="text-muted">{req.status === 'pending' ? 'Pending' : req.status === 'accepted' ? 'Accepted' : req.status === 'declined' ? 'Declined' : req.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-1 bg-panel p-4 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold mb-3 text-text">Add a Friend</h2>
          <form onSubmit={handleSendRequest} className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              className="input flex-1"
            />
            <button type="submit" className="btn bg-accent">Send Request</button>
          </form>
        </div>
      </div>
    </PageWithHeader>
  );
}
