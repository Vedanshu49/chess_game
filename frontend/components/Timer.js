import { useEffect, useState } from 'react'

export default function Timer({ base, running, lastEpoch }){
  const [val,setVal] = useState(base)

  useEffect(()=>{
    setVal(base)
  }, [base])

  useEffect(()=>{
    if(!running) return
    const interval = setInterval(()=>{
      setVal(v => Math.max(0, v - 1))
    }, 1000)
    return ()=> clearInterval(interval)
  }, [running])

  const mm = Math.floor(val/60).toString().padStart(2,'0')
  const ss = Math.floor(val%60).toString().padStart(2,'0')
  return <div className={`px-3 py-2 rounded-xl font-mono text-lg ${running?'bg-accent text-black':'bg-[#0e141b] border border-[#233041]'}`}>{mm}:{ss}</div>
}
