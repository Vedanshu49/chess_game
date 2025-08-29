import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabasejs'
import { useRouter } from 'next/router'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Password updated successfully!')
      setTimeout(() => router.push('/login'), 2000)
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="max-w-md w-full bg-panel p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-text text-center mb-6">Reset Password</h1>
        <form onSubmit={handleResetPassword}>
          <div className="mb-4">
            <label htmlFor="password" className="block text-muted mb-2">New Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-[#222222] border border-muted text-text focus:outline-none focus:border-accent"
              required
            />
          </div>
          <button
            type="submit"
            className="btn w-full"
            disabled={loading}
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        {message && <p className="text-center text-text mt-4">{message}</p>}
      </div>
    </div>
  )
}