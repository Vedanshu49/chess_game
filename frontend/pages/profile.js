import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import NavBar from '@/components/NavBar'
import { useRouter } from 'next/router'
import Avatar from '@/components/Avatar'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        setUser(auth.user)
      } else {
        router.replace('/login')
      }
    })()
  }, [])

  useEffect(() => {
    if (user) {
      fetchProfile()
    }
  }, [user])

  async function fetchProfile() {
    if (!user) return
    setLoading(true)

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
    } else {
      setProfile(data)
    }

    setLoading(false)
  }

  async function updateAvatar(avatarUrl) {
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
    if (!newUsername.trim()) return;

    const { error } = await supabase
      .from('profiles')
      .update({ username: newUsername.trim() })
      .eq('id', user.id);

    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Username updated!');
      setProfile({ ...profile, username: newUsername.trim() });
      setNewUsername('');
    }
  }

  if (loading || !profile) {
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
