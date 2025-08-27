import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'

export default function Join(){
  const r = useRouter()
  const { code } = r.query

  useEffect(()=>{
    async function go(){
      const { data:auth } = await supabase.auth.getUser()
      if(!auth.user){ r.replace('/login'); return }
      // find game by invite code
      const { data:game, error } = await supabase.from('games')
        .select('*')
        .eq('invite_code', code)
        .maybeSingle()
      if(error || !game){ alert('Invalid code'); r.replace('/dashboard'); return }
      if(game.opponent && game.opponent !== auth.user.id){
        alert('Game already has an opponent'); r.replace('/dashboard'); return
      }
      // set opponent and start
      const { error:upErr } = await supabase.from('games')
        .update({ opponent: auth.user.id, status: 'in_progress' })
        .eq('id', game.id)
      if(upErr){ alert(upErr.message); r.replace('/dashboard'); return }
      r.replace(`/game/${game.id}`)
    }
    if(code) go()
  },[code])

  return null
}
