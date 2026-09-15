import { useContext } from 'react'
import { AuthContext } from './sessionContext'

export function useAuth() {
  return useContext(AuthContext)
}
