import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabasejs';
import { useRouter } from 'next/router';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/lib/AuthProvider';
import PageWithHeader from '@/components/PageWithHeader';
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    } else if (user) {
      // The user object from useAuth should already contain the profile
      if (user.profile) {
        setProfile(user.profile);
        setProfileLoading(false);
      } else {
        // Fallback if profile is not in the auth user object for some reason
        fetchProfile();
      }
    }
  }, [user, authLoading, router]);

  async function fetchProfile() {
    if (!user) return;
    setProfileLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) throw error;
      setProfile(data);
    } catch (error) {
      toast.error('Failed to fetch profile: ' + error.message);
    } finally {
      setProfileLoading(false);
    }
  }

  async function updateAvatar(avatarUrl) {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id);
      if (error) throw error;
      await fetchProfile(); // Refresh profile after avatar update
      toast.success('Avatar updated!');
    } catch (error) {
      toast.error('Error updating avatar: ' + error.message);
    }
  }

  async function handleUpdateUsername(e) {
    e.preventDefault();
    if (!newUsername.trim() || !user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ username: newUsername.trim() })
        .eq('id', user.id);
      if (error) {
        console.error('Supabase update username error:', error);
        throw error;
      }
      await fetchProfile(); // Refresh profile after username update
      setNewUsername('');
      toast.success('Username updated!');
    } catch (error) {
      toast.error('Error updating username: ' + error.message);
    }
  }

  if (authLoading || profileLoading) {
    return (
      <PageWithHeader user={user} title="Profile">
        <LoadingSpinner />
      </PageWithHeader>
    );
  }

  if (!profile) {
    return (
      <PageWithHeader user={user} title="Profile">
        <p>Could not load profile.</p>
      </PageWithHeader>
    );
  }

  return (
    <PageWithHeader user={user} title="Profile">
      <div className="max-w-md mx-auto bg-panel rounded-lg shadow-lg p-6">
        <div className="flex flex-col items-center mb-6">
          <Avatar
            url={profile.avatar_url}
            size={150}
            onUpload={updateAvatar}
            userId={user.id}
          />
          <h1 className="text-3xl font-bold text-text text-center mt-4">{profile.username}</h1>
        </div>
        <div className="flex justify-center items-center space-x-4 text-lg mb-6">
          <div className="text-center">
            <p className="text-muted">Rating</p>
            <p className="text-text font-semibold">{profile.rating}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-muted">Wins</p>
            <p className="text-green-500 font-semibold">{profile.wins}</p>
          </div>
          <div>
            <p className="text-muted">Losses</p>
            <p className="text-red-500 font-semibold">{profile.losses}</p>
          </div>
          <div>
            <p className="text-muted">Draws</p>
            <p className="text-muted font-semibold">{profile.draws}</p>
          </div>
        </div>
        <div className="mt-6">
          <form onSubmit={handleUpdateUsername} className="flex gap-2">
            <input
              type="text"
              name="username"
              autocomplete="username"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="New username"
              className="input flex-1"
            />
            <button type="submit" className="btn bg-accent">Update</button>
          </form>
        </div>
      </div>
    </PageWithHeader>
  );
}
