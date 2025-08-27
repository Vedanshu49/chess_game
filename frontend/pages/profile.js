import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/lib/AuthProvider' // Import useAuth

export default function ProfilePage() {
  const { user, loading } = useAuth(); // Use the useAuth hook
  const router = useRouter()
  const [profile, setProfile] = useState(null); // Keep local profile state for updates

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    } else if (user && user.profile) {
      setProfile(user.profile); // Set profile from auth context
    }
  }, [user, loading, router]);

  async function updateAvatar(avatarUrl) {
    if (!user || !user.profile) return;
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id)

    if (error) {
      alert(error.message)
    }
  }

  const [newUsername, setNewUsername] = useState('');

  async function handleUpdateUsername(e) {
    e.preventDefault();
    if (!newUsername.trim() || !user || !user.profile) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername.trim() })
      .eq('id', user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Username updated!');
      setProfile({ ...profile, username: newUsername.trim() }); // Update local profile state
      setNewUsername('');
    }
  }

  if (loading || !profile) { // Check for loading from useAuth and local profile state
    return <div>Loading...</div>
  }

  return (
    <>
      <NavBar user={user} />
      <div className="container mx-auto p-4">
        <div className="max-w-md mx-auto bg-[#1c2836] rounded-lg shadow-lg p-6">
          <div className="flex flex-col items-center mb-6">
            <Avatar
              url={profile.avatar_url}
              size={150}
              onUpload={(url) => {
                updateAvatar(url)
                setProfile({ ...profile, avatar_url: url })
              }}
            />
            <h1 className="text-3xl font-bold text-white text-center mt-4">{profile.username}</h1>
          </div>
          <div className="flex justify-center items-center space-x-4 text-lg mb-6">
            <div className="text-center">
              <p className="text-gray-400">Rating</p>
              <p className="text-white font-semibold">{profile.rating}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-gray-400">Wins</p>
              <p className="text-green-500 font-semibold">{profile.wins}</p>
            </div>
            <div>
              <p className="text-gray-400">Losses</p>
              <p className="text-red-500 font-semibold">{profile.losses}</p>
            </div>
            <div>
              <p className="text-gray-400">Draws</p>
              <p className="text-gray-500 font-semibold">{profile.draws}</p>
            </div>
          </div>

          <div className="mt-6">
            <form onSubmit={handleUpdateUsername} className="flex gap-2">
              <input
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="New username"
                className="flex-1 bg-[#0e141b] rounded-lg px-3 py-2"
              />
              <button type="submit" className="btn bg-blue-600 hover:bg-blue-700">Update</button>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}
