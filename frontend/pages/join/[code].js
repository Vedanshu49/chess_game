import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabasejs'
import toast from 'react-hot-toast';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function Join(){
  const r = useRouter()
  const { code } = r.query
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(()=>{
    async function go(){
      const { data:auth } = await supabase.auth.getUser()
      if(!auth.user){ r.replace('/login'); return }
      // find game by invite code
      const { data:game, error } = await supabase.from('games')
        .select('*')
        .eq('invite_code', code)
        .maybeSingle()
      if(error || !game){ 
        toast.error('Invalid code'); 
        r.replace('/dashboard'); 
        return 
      }
      if(game.opponent && game.opponent !== auth.user.id){
        toast.error('Game already has an opponent'); 
        r.replace('/dashboard'); 
        return
      }
      // set opponent and start
      const { error:upErr } = await supabase.from('games')
        .update({ opponent: auth.user.id, status: 'in_progress', players_joined: game.players_joined + 1 })
        .eq('id', game.id)
      if(upErr){ 
        toast.error(upErr.message); 
        r.replace('/dashboard'); 
        return 
      }
      r.replace(`/game/${game.id}`)
    }
    if(code) go()
  },[code])

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <LoadingSpinner />
      <p className="text-text ml-4">Joining game...</p>
    </div>
  )
}