import { useEffect, useState } from 'react'

export function useAuthMessage() {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    // Check for logout message on mount
    if (typeof window !== 'undefined') {
      const logoutMessage = sessionStorage.getItem('logout_message')
      if (logoutMessage) {
        setMessage(logoutMessage)
        sessionStorage.removeItem('logout_message')
      }
    }
  }, [])

  const clearMessage = () => setMessage(null)

  return { message, clearMessage }
}
