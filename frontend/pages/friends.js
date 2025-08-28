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
      if (findError) throw new Error('User not found.');
      if (friendUser.id === user.id) throw new Error("You can't send a friend request to yourself.");

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
          <div className="bg-[#1c2836] p-6 rounded-lg w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Challenge {challengeModal.friendUsername}</h2>
            <div className="space-y-4">
              <p>Select Time Control:</p>
              <div className="flex flex-wrap gap-2">
                {[ {t:1,i:0}, {t:3,i:2}, {t:5,i:0}, {t:10,i:5} ].map(tc => (
                  <button key={`${tc.t}-${tc.i}`} onClick={() => setTimeControl({ time: tc.t, increment: tc.i })} className={`btn ${timeControl.time === tc.t && timeControl.increment === tc.i ? 'bg-green-600' : 'bg-gray-600'}`}>
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
              <button onClick={() => setChallengeModal({ isOpen: false, friendId: null, friendUsername: null })} className="btn bg-gray-700">Cancel</button>
              <button onClick={handleChallenge} className="btn bg-blue-600">Send Challenge</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold mb-3">Your Friends ({friends.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
              {friends.map(friend => (
                <li key={friend.id} className="bg-[#1c2836] p-3 rounded-lg flex justify-between items-center">
                  <span>{friend.username}</span>
                  <button onClick={() => setChallengeModal({ isOpen: true, friendId: friend.id, friendUsername: friend.username })} className="btn bg-blue-600 hover:bg-blue-700">Challenge</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold mb-3">Friend Requests ({pendingRequests.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
              {pendingRequests.map(req => (
                <li key={req.id} className="bg-[#1c2836] p-3 rounded-lg flex justify-between items-center">
                  <span>{req.user.username}</span>
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptRequest(req.id)} className="btn bg-green-600 hover:bg-green-700">Accept</button>
                    <button onClick={() => handleRejectRequest(req.id)} className="btn bg-red-600 hover:bg-red-700">Reject</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2 className="text-xl font-semibold mb-3 mt-6">Sent Requests ({sentRequests.length})</h2>
          {loading ? <LoadingSpinner /> : (
            <ul className="space-y-2">
              {sentRequests.map(req => (
                <li key={req.id} className="bg-[#1c2836] p-3 rounded-lg flex justify-between items-center">
                  <span>{req.friend.username}</span>
                  <span className="text-muted">Pending</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="md:col-span-1">
          <h2 className="text-xl font-semibold mb-3">Add a Friend</h2>
          <form onSubmit={handleSendRequest} className="flex gap-2">
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              className="flex-1 bg-[#0e141b] rounded-lg px-3 py-2"
            />
            <button type="submit" className="btn bg-blue-600 hover:bg-blue-700">Send Request</button>
          </form>
        </div>
      </div>
    </PageWithHeader>
  );
}
